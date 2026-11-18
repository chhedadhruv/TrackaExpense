import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {DEFAULT_TIME_ZONE} from './budgets';
import {funContext, funDueDate, funMessage} from './fun';
import {notifyUids, type NotifyDeps} from './notify';

const ALREADY_EXISTS = 6;
const DAY_MS = 86_400_000;

export interface FunDeps extends NotifyDeps {
  db: Firestore;
  now?: () => number;
}

export interface FunRunResult {
  sent: string[];
}

const dayBefore = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - days * DAY_MS)
    .toISOString()
    .slice(0, 10);
};

/**
 * The evening nudge: once a day per person, at a local hour between 18 and 21 that is fixed by
 * their id and the date. The marker `users/{uid}/reminderLogs/fun_{date}` is created with
 * `create()` first, so reruns and overlapping runs send once. The tone depends on whether they
 * logged anything today or in the last two days.
 */
export const runFun = async (deps: FunDeps): Promise<FunRunResult> => {
  const nowMs = (deps.now ?? Date.now)();
  const result: FunRunResult = {sent: []};
  const users = await deps.db.collection('users').select('timeZone').get();

  for (const doc of users.docs) {
    const zone = doc.get('timeZone');
    const due = funDueDate(
      nowMs,
      doc.id,
      typeof zone === 'string' && zone !== '' ? zone : DEFAULT_TIME_ZONE,
    );
    if (due === null) {
      continue;
    }
    const marker = doc.ref.collection('reminderLogs').doc(`fun_${due.date}`);
    try {
      await marker.create({
        date: due.date,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if ((error as {code?: unknown}).code === ALREADY_EXISTS) {
        continue;
      }
      logger.error('Fun marker failed', {
        path: marker.path,
        error: String(error),
      });
      continue;
    }
    try {
      const transactions = doc.ref.collection('transactions');
      const recent = await transactions
        .where('dateISO', '>=', dayBefore(due.date, 2))
        .select('dateISO')
        .get();
      const activeToday = recent.docs.some(d => d.get('dateISO') === due.date);
      const context = funContext(activeToday, !recent.empty, due.weekday);
      const message = funMessage(context, doc.id, due.date);
      const pushed = await notifyUids(deps, [doc.id], {
        ...message,
        data: {type: 'fun_notification', context},
      });
      if (pushed) {
        result.sent.push(doc.id);
        await marker.update({context, sentAt: FieldValue.serverTimestamp()});
      }
    } catch (error) {
      await marker.delete().catch(() => undefined);
      logger.error('Fun nudge failed', {uid: doc.id, error: String(error)});
    }
  }
  return result;
};
