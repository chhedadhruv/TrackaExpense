import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {notifyUids, type NotifyDeps} from './notify';
import {fromMinor, toMajorNumber} from './money';
import {
  buildTransaction,
  parseRule,
  planRun,
  recurringTransactionId,
  todayInZone,
} from './recurring';

export interface RecurringDeps extends NotifyDeps {
  db: Firestore;
  now?: () => number;
}

export interface RecurringRunResult {
  /** Rules looked at. */
  rules: number;
  /** Transaction documents created by this run. */
  created: string[];
  /** Occurrences passed over because they were more than three days late. */
  skipped: number;
  /** Rules that could not be processed (a failed transaction); they are tried again next run. */
  failed: number;
}

const DAY_MS = 86_400_000;

interface RuleOutcome {
  created: string[];
  skipped: number;
}

/**
 * Applies one rule in a single Firestore transaction: creates the transaction document of each due
 * occurrence (the id comes from the rule and the date, so it can exist only once), changes the
 * user's legacy `balance` by exactly the amount created, and moves the rule on. All or nothing,
 * and a second run sees the moved `nextDueDate` and the existing documents, so it does nothing.
 */
const processRule = async (
  deps: RecurringDeps,
  ruleRef: FirebaseFirestore.DocumentReference,
  nowMs: number,
): Promise<
  RuleOutcome & {title: string; amountMinor: number; currency: string}
> => {
  const userRef = ruleRef.parent.parent;
  if (!userRef) {
    throw new Error('A recurring rule must sit under a user.');
  }
  return deps.db.runTransaction(async t => {
    const snap = await t.get(ruleRef);
    const rule = snap.exists ? parseRule(snap.id, snap.data()) : null;
    const empty = {
      created: [],
      skipped: 0,
      title: '',
      amountMinor: 0,
      currency: 'INR',
    };
    if (!rule || !rule.enabled) {
      return empty;
    }
    const plan = planRun(rule, todayInZone(nowMs, rule.timeZone));
    if (
      plan.create.length === 0 &&
      plan.skipped.length === 0 &&
      !plan.finished &&
      plan.nextDueDate === rule.nextDueDate
    ) {
      return {
        ...empty,
        title: rule.title,
        amountMinor: rule.amountMinor,
        currency: rule.currency,
      };
    }

    const transactions = userRef.collection('transactions');
    const refs = plan.create.map(date =>
      transactions.doc(recurringTransactionId(rule.id, date)),
    );
    // All reads before any write.
    const existing = await Promise.all(refs.map(r => t.get(r)));
    const created: string[] = [];
    plan.create.forEach((date, i) => {
      if (existing[i].exists) {
        return;
      }
      t.create(refs[i], {
        ...buildTransaction(rule, userRef.id, date, refs[i].id),
        createdAt: FieldValue.serverTimestamp(),
      });
      created.push(refs[i].id);
    });
    // A card expense does not touch the balance (it drops when the card bill is paid), the same
    // rule as the app's balanceEffect in src/utils/amounts.ts.
    if (created.length > 0 && rule.cardId === null) {
      // Same effect as Add Expense and Add Income: expense takes away, income adds. The total is
      // summed in integer minor units first, so there is no float noise from repeated addition.
      const total = toMajorNumber(
        rule.amountMinor * created.length,
        rule.currency,
      );
      t.update(userRef, {
        balance: FieldValue.increment(rule.type === 'expense' ? -total : total),
      });
    }
    t.update(ruleRef, {
      nextDueDate: plan.nextDueDate,
      lastRunAt: FieldValue.serverTimestamp(),
      ...(plan.finished ? {enabled: false, finished: true} : {}),
    });
    return {
      created,
      skipped: plan.skipped.length,
      title: rule.title,
      amountMinor: rule.amountMinor,
      currency: rule.currency,
    };
  });
};

/**
 * One pass over every rule that may be due. The query asks for `nextDueDate` up to tomorrow's UTC
 * date, which covers every time zone; each rule then decides for itself what "today" is. Safe to
 * run as often as you like.
 */
export const runRecurring = async (
  deps: RecurringDeps,
): Promise<RecurringRunResult> => {
  const nowMs = (deps.now ?? Date.now)();
  const result: RecurringRunResult = {
    rules: 0,
    created: [],
    skipped: 0,
    failed: 0,
  };
  const upperBound = new Date(nowMs + DAY_MS).toISOString().slice(0, 10);
  const snapshot = await deps.db
    .collectionGroup('recurring')
    .where('nextDueDate', '<=', upperBound)
    .get();

  for (const doc of snapshot.docs) {
    result.rules += 1;
    try {
      const outcome = await processRule(deps, doc.ref, nowMs);
      result.created.push(...outcome.created);
      result.skipped += outcome.skipped;
      if (outcome.created.length > 0) {
        const uid = doc.ref.parent.parent?.id;
        if (uid) {
          const amount = fromMinor(outcome.amountMinor, outcome.currency);
          await notifyUids(deps, [uid], {
            title: 'Recurring logged',
            body:
              outcome.created.length === 1
                ? `${outcome.title} (${amount} ${outcome.currency}) was added.`
                : `${outcome.title} was added ${outcome.created.length} times.`,
            data: {type: 'recurring_logged', recurringId: doc.id},
          });
        }
      }
    } catch (error) {
      result.failed += 1;
      logger.error('Recurring rule failed', {
        path: doc.ref.path,
        error: String(error),
      });
    }
  }
  return result;
};
