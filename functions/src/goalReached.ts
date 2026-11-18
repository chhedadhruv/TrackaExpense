import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import type {Fields} from './derive';
import {notifyUids, type NotifyDeps} from './notify';

/**
 * "Savings goal reached": one alert, and one push, each time a goal's saved amount goes from below
 * its target to at or above it. It watches the goal documents `users/{uid}/goals/{goalId}`, which
 * hold exact integer minor amounts (the app writes them with the array, and the `goalsFromUser`
 * trigger mirrors old apps' array writes into them), so it needs no extra derivation.
 */

/** True when the goal has a positive target and the saved amount has reached it. */
export const isReached = (goal: Fields | undefined): boolean =>
  goal !== undefined &&
  typeof goal.targetMinor === 'number' &&
  goal.targetMinor > 0 &&
  typeof goal.currentMinor === 'number' &&
  goal.currentMinor >= goal.targetMinor;

/**
 * The write that makes a goal reached: it is reached after the write and was not before (a new
 * document counts as not reached before). Edits of a goal that is already reached do not count, and
 * a goal that is withdrawn from and then filled again crosses again.
 */
export const crossedTarget = (
  before: Fields | undefined,
  after: Fields | undefined,
): boolean => isReached(after) && !isReached(before);

export interface GoalReachedDeps extends NotifyDeps {
  db: Firestore;
}

export type GoalReachedResult = 'pushed' | 'recorded' | 'duplicate';

/**
 * Records the alert `users/{uid}/goalAlerts/{eventId}` and pushes once. The alert id is the id of
 * the Firestore event that caused it, which is the same on every redelivery of that event, and the
 * document is created with `create()`, so a retried event cannot send the push twice. 'recorded'
 * means the alert exists but the push did not go out (no OneSignal key, or OneSignal refused it).
 */
export const notifyGoalReached = async (
  deps: GoalReachedDeps,
  uid: string,
  goalId: string,
  goal: Fields,
  eventId: string,
): Promise<GoalReachedResult> => {
  const ref = deps.db
    .collection('users')
    .doc(uid)
    .collection('goalAlerts')
    .doc(eventId);
  try {
    await ref.create({
      goalId,
      goalName: typeof goal.name === 'string' ? goal.name : '',
      currentMinor: goal.currentMinor,
      targetMinor: goal.targetMinor,
      currency: typeof goal.currency === 'string' ? goal.currency : '',
      pushed: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if ((error as {code?: unknown}).code === 6) {
      return 'duplicate';
    }
    throw error;
  }
  const label =
    typeof goal.name === 'string' && goal.name !== ''
      ? `"${goal.name}"`
      : 'your goal';
  const pushed = await notifyUids(deps, [uid], {
    title: 'Savings goal reached',
    body: `You have reached ${label}.`,
    data: {type: 'goal_reached', goalId},
  });
  if (!pushed) {
    return 'recorded';
  }
  await ref.update({pushed: true}).catch(error => {
    logger.warn('Could not mark the goal alert as pushed', {
      path: ref.path,
      error: String(error),
    });
  });
  return 'pushed';
};
