import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {
  alertId,
  crossedThresholds,
  parseBudget,
  periodFor,
  spentMinor,
  todayInZone,
  type Budget,
  type Threshold,
} from './budgets';
import type {Fields} from './derive';
import {notifyUids, type NotifyDeps} from './notify';

export interface BudgetAlertDeps extends NotifyDeps {
  db: Firestore;
  now?: () => number;
}

export interface BudgetAlertResult {
  /** Alert documents created by this run (one per budget, period and threshold, ever). */
  created: string[];
}

const ALREADY_EXISTS = 6;

const alertText = (
  budget: Budget,
  threshold: Threshold,
): {title: string; body: string} => {
  const subject =
    budget.name !== '' ? `your ${budget.name} budget` : 'your budget';
  if (threshold === 100) {
    return {title: 'Budget reached', body: `You have used all of ${subject}.`};
  }
  if (threshold > 100) {
    return {
      title: 'Budget exceeded',
      body: `You are ${threshold - 100} percent over ${subject}.`,
    };
  }
  return {
    title: 'Budget alert',
    body: `You have used ${threshold} percent of ${subject}.`,
  };
};

/**
 * Checks every enabled budget of one user against the transactions of the budget's current period
 * and records an alert for each switched-on threshold that has been reached. The alert document is
 * created with `create()`, which fails when it already exists, so a threshold fires once per budget
 * and period no matter how many times this runs or how many runs overlap. A push is sent only by
 * the run that created the document.
 */
export const evaluateBudgets = async (
  deps: BudgetAlertDeps,
  uid: string,
): Promise<BudgetAlertResult> => {
  const {db} = deps;
  const nowMs = (deps.now ?? Date.now)();
  const result: BudgetAlertResult = {created: []};
  const userRef = db.collection('users').doc(uid);

  const budgetDocs = await userRef.collection('budgets').get();
  const active: {
    budget: Budget;
    period: NonNullable<ReturnType<typeof periodFor>>;
  }[] = [];
  for (const doc of budgetDocs.docs) {
    const budget = parseBudget(doc.id, doc.data());
    if (budget === null || !budget.enabled) {
      continue;
    }
    const period = periodFor(budget, todayInZone(nowMs, budget.timeZone));
    if (period !== null) {
      active.push({budget, period});
    }
  }
  if (active.length === 0) {
    return result;
  }

  const earliest = active.map(a => a.period.start).sort()[0];
  const snapshot = await userRef
    .collection('transactions')
    .where('dateISO', '>=', earliest)
    .get();
  const transactions = snapshot.docs.map(d => d.data() as Fields);

  for (const {budget, period} of active) {
    const spent = spentMinor(budget, period, transactions);
    for (const threshold of crossedThresholds(budget, spent)) {
      const ref = userRef
        .collection('budgetAlerts')
        .doc(alertId(budget.id, period, threshold));
      try {
        await ref.create({
          budgetId: budget.id,
          budgetName: budget.name,
          periodKey: period.key,
          threshold,
          spentMinor: spent,
          limitMinor: budget.limitMinor,
          currency: budget.currency,
          pushed: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        if ((error as {code?: unknown}).code === ALREADY_EXISTS) {
          continue;
        }
        throw error;
      }
      result.created.push(ref.id);
      const text = alertText(budget, threshold);
      const pushed = await notifyUids(deps, [uid], {
        ...text,
        data: {
          type: 'budget_alert',
          budgetId: budget.id,
          threshold: String(threshold),
        },
      });
      if (pushed) {
        await ref.update({pushed: true}).catch(error => {
          logger.warn('Could not mark the budget alert as pushed', {
            path: ref.path,
            error: String(error),
          });
        });
      }
    }
  }
  return result;
};
