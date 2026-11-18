import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {DEFAULT_TIME_ZONE} from './budgets';
import {resolveCurrency, type Fields} from './derive';
import {fromMinor} from './money';
import {notifyUids, type NotifyDeps} from './notify';
import {
  isQuietWeek,
  monthToSummarize,
  summarizeWeek,
  weekToSummarize,
  type WeekRange,
  type WeekSummary,
} from './weekly';

const ALREADY_EXISTS = 6;

export interface WeeklyDeps extends NotifyDeps {
  db: Firestore;
  now?: () => number;
}

export interface WeeklyRunResult {
  /** Users looked at. */
  users: number;
  /** Marker documents created by this run (one per user whose summary hour it is). */
  created: string[];
  /** Users whose summary could not be built; the marker is removed so a later run tries again. */
  failed: number;
}

interface PeriodKind {
  /** Subcollection holding the marker documents. */
  markers: string;
  rangeFor: (nowMs: number, timeZone: string) => WeekRange | null;
  message: (
    summary: WeekSummary,
    currency: string,
  ) => {title: string; body: string};
  dataType: string;
}

const spentText = (summary: WeekSummary, currency: string): string =>
  `${fromMinor(summary.spentMinor, currency)} ${currency}`;

const topText = (summary: WeekSummary): string =>
  summary.topCategory === null ? '' : ` Most on ${summary.topCategory}.`;

const WEEKLY: PeriodKind = {
  markers: 'weeklyAlerts',
  rangeFor: weekToSummarize,
  dataType: 'weekly_summary',
  message: (summary, currency) => ({
    title: 'Your week in review',
    body: `You spent ${spentText(
      summary,
      currency,
    )} in the last 7 days.${topText(summary)}`,
  }),
};

const MONTHLY: PeriodKind = {
  markers: 'monthlyAlerts',
  rangeFor: monthToSummarize,
  dataType: 'monthly_summary',
  message: (summary, currency) => ({
    title: 'Your month in review',
    body: `You spent ${spentText(summary, currency)} last month.${topText(
      summary,
    )}`,
  }),
};

/**
 * One hourly pass: for every user whose local time is the summary hour of the period, creates the
 * marker `users/{uid}/{markers}/{key}` with `create()` (so a rerun or overlapping runs send
 * once), and pushes the summary. A quiet period keeps its marker and sends nothing. The user's
 * zone is `users/{uid}.timeZone` when the app has stored one, else the default zone.
 */
const runPeriodic = async (
  deps: WeeklyDeps,
  kind: PeriodKind,
): Promise<WeeklyRunResult> => {
  const nowMs = (deps.now ?? Date.now)();
  const result: WeeklyRunResult = {users: 0, created: [], failed: 0};
  const users = await deps.db
    .collection('users')
    .select('currency', 'timeZone')
    .get();

  for (const doc of users.docs) {
    result.users += 1;
    const zone = doc.get('timeZone');
    const range = kind.rangeFor(
      nowMs,
      typeof zone === 'string' && zone !== '' ? zone : DEFAULT_TIME_ZONE,
    );
    if (range === null) {
      continue;
    }
    const marker = doc.ref.collection(kind.markers).doc(range.key);
    try {
      await marker.create({
        periodStart: range.start,
        periodEnd: range.end,
        pushed: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if ((error as {code?: unknown}).code === ALREADY_EXISTS) {
        continue;
      }
      result.failed += 1;
      logger.error('Summary marker failed', {
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
      const pushed = await notifyUids(deps, [doc.id], {
        ...kind.message(summary, currency),
        data: {type: kind.dataType, periodEnd: range.end},
      });
      if (pushed) {
        await marker.update({pushed: true}).catch(error => {
          logger.warn('Could not mark the summary as pushed', {
            path: marker.path,
            error: String(error),
          });
        });
      }
    } catch (error) {
      // Free the marker so a later run can try again.
      result.failed += 1;
      await marker.delete().catch(() => undefined);
      logger.error('Summary failed', {
        path: marker.path,
        error: String(error),
      });
    }
  }
  return result;
};

export const runWeekly = (deps: WeeklyDeps): Promise<WeeklyRunResult> =>
  runPeriodic(deps, WEEKLY);

export const runMonthly = (deps: WeeklyDeps): Promise<WeeklyRunResult> =>
  runPeriodic(deps, MONTHLY);
