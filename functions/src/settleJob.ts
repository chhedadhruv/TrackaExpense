import {Timestamp, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {DEFAULT_TIME_ZONE} from './budgets';
import {resolveCurrency, type Fields} from './derive';
import {fromMinor} from './money';
import {notifyUids, type NotifyDeps} from './notify';
import {
  netDebts,
  owedByPerson,
  SETTLE_COOLDOWN_DAYS,
  SETTLE_HOUR,
  worthReminding,
  type Debt,
} from './settleReminders';
import {localMoment} from './weekly';

export interface SettleDeps extends NotifyDeps {
  db: Firestore;
  now?: () => number;
}

export interface SettleRunResult {
  /** Users whose reminder was claimed (and pushed) by this run. */
  reminded: string[];
}

const DAY_MS = 86_400_000;

/**
 * Settle-up reminders: on Sunday at SETTLE_HOUR local time, each person who owes money (in their
 * own currency, at least one whole unit) gets one push, at most once every SETTLE_COOLDOWN_DAYS.
 * The cooldown is claimed in a Firestore transaction on `users/{uid}/reminderLogs/settle_reminder`
 * before the push, so overlapping runs cannot both send. Groups and IOUs are read only when at
 * least one user is in their reminder hour.
 */
export const runSettleReminders = async (
  deps: SettleDeps,
): Promise<SettleRunResult> => {
  const nowMs = (deps.now ?? Date.now)();
  const result: SettleRunResult = {reminded: []};
  const users = await deps.db
    .collection('users')
    .select('email', 'currency', 'timeZone')
    .get();

  const due = new Map<
    string,
    {uid: string; currency: string; ref: FirebaseFirestore.DocumentReference}
  >();
  for (const doc of users.docs) {
    const zone = doc.get('timeZone');
    const local = localMoment(
      nowMs,
      typeof zone === 'string' && zone !== '' ? zone : DEFAULT_TIME_ZONE,
    );
    const email = doc.get('email');
    if (local.weekday !== 0 || local.hour !== SETTLE_HOUR) {
      continue;
    }
    if (typeof email === 'string' && email !== '') {
      due.set(email.trim().toLowerCase(), {
        uid: doc.id,
        currency: resolveCurrency(doc.get('currency')),
        ref: doc.ref,
      });
    }
  }
  if (due.size === 0) {
    return result;
  }

  const debts: Debt[] = [];
  const groups = await deps.db.collection('groups').select().get();
  for (const group of groups.docs) {
    try {
      const splits = await group.ref.collection('splits').get();
      debts.push(...netDebts(splits.docs.map(s => s.data() as Fields)));
    } catch (error) {
      logger.error('Settle reminder: group failed', {
        path: group.ref.path,
        error: String(error),
      });
    }
  }
  const ious = await deps.db
    .collection('ious')
    .where('status', '==', 'pending')
    .get();
  const owed = owedByPerson(
    debts,
    ious.docs.map(d => d.data() as Fields),
  );

  for (const [email, person] of due) {
    const owes = owed.get(email)?.get(person.currency);
    if (!owes || !worthReminding(owes.total, person.currency)) {
      continue;
    }
    const log = person.ref.collection('reminderLogs').doc('settle_reminder');
    try {
      const claimed = await deps.db.runTransaction(async t => {
        const snap = await t.get(log);
        const last = snap.exists ? snap.get('lastSentAt') : undefined;
        if (
          last instanceof Timestamp &&
          nowMs - last.toMillis() < SETTLE_COOLDOWN_DAYS * DAY_MS
        ) {
          return false;
        }
        t.set(log, {
          lastSentAt: Timestamp.fromMillis(nowMs),
          totalMinor: owes.total,
          count: owes.count,
          currency: person.currency,
        });
        return true;
      });
      if (!claimed) {
        continue;
      }
      const amount = `${fromMinor(owes.total, person.currency)} ${
        person.currency
      }`;
      await notifyUids(deps, [person.uid], {
        title: 'Settle Up Reminder',
        body:
          owes.count > 1
            ? `You have ${owes.count} outstanding balances totalling ${amount}. Time to settle up!`
            : `You owe ${amount}. Time to settle up!`,
        data: {type: 'settlement_reminder', action: 'view_balances'},
      });
      result.reminded.push(person.uid);
    } catch (error) {
      logger.error('Settle reminder failed', {
        uid: person.uid,
        error: String(error),
      });
    }
  }
  return result;
};
