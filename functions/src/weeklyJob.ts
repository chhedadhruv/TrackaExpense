import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {DEFAULT_TIME_ZONE} from './budgets';
import {resolveCurrency, type Fields} from './derive';
import {fromMinor} from './money';
import {notifyUids, type NotifyDeps} from './notify';
import {isQuietWeek, summarizeWeek, weekToSummarize} from './weekly';

const ALREADY_EXISTS = 6;

export interface WeeklyDeps extends NotifyDeps {
  db: Firestore;
  now?: () => number;
}

export interface WeeklyRunResult {
  /** Users looked at. */
  users: number;
  /** Marker documents created by this run (one per user whose Sunday 9 AM it is). */
  created: string[];
  /** Users whose summary could not be built; tried again next hour (the marker is not kept). */
  failed: number;
}

/**
 * One hourly pass: for every user whose local time is Sunday 9 AM, creates the week's marker
 * `users/{uid}/weeklyAlerts/{endDate}` with `create()` (so a rerun or overlapping runs send
 * once), and pushes the summary. A quiet week keeps its marker and sends nothing. The user's zone
 * is `users/{uid}.timeZone` when the app has stored one, else the default zone.
 */
export const runWeekly = async (deps: WeeklyDeps): Promise<WeeklyRunResult> => {
  const nowMs = (deps.now ?? Date.now)();
  const result: WeeklyRunResult = {users: 0, created: [], failed: 0};
  const users = await deps.db
    .collection('users')
    .select('currency', 'timeZone')
    .get();

  for (const doc of users.docs) {
    result.users += 1;
    const zone = doc.get('timeZone');
    const range = weekToSummarize(
      nowMs,
      typeof zone === 'string' && zone !== '' ? zone : DEFAULT_TIME_ZONE,
    );
    if (range === null) {
      continue;
    }
    const marker = doc.ref.collection('weeklyAlerts').doc(range.key);
    try {
      await marker.create({
        weekStart: range.start,
        weekEnd: range.end,
        pushed: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if ((error as {code?: unknown}).code === ALREADY_EXISTS) {
        continue;
      }
      result.failed += 1;
      logger.error('Weekly marker failed', {
        path: marker.path,
        error: String(error),
      });
      continue;
    }
    result.created.push(marker.path);
    try {
      const currency = resolveCurrency(doc.get('currency'));
      const snapshot = await doc.ref
        .collection('transactions')
        .where('dateISO', '>=', range.start)
        .where('dateISO', '<=', range.end)
        .get();
      const summary = summarizeWeek(
        currency,
        range,
        snapshot.docs.map(d => d.data() as Fields),
      );
      if (isQuietWeek(summary)) {
        continue;
      }
      const spent = `${fromMinor(summary.spentMinor, currency)} ${currency}`;
      const top =
        summary.topCategory === null ? '' : ` Most on ${summary.topCategory}.`;
      const pushed = await notifyUids(deps, [doc.id], {
        title: 'Your week in review',
        body: `You spent ${spent} in the last 7 days.${top}`,
        data: {type: 'weekly_summary', weekEnd: range.end},
      });
      if (pushed) {
        await marker.update({pushed: true}).catch(error => {
          logger.warn('Could not mark the weekly summary as pushed', {
            path: marker.path,
            error: String(error),
          });
        });
      }
    } catch (error) {
      // Free the marker so the next hour tries again, still inside the 9 o'clock hour only if the
      // run was early; later it simply skips this week.
      result.failed += 1;
      await marker.delete().catch(() => undefined);
      logger.error('Weekly summary failed', {
        path: marker.path,
        error: String(error),
      });
    }
  }
  return result;
};
