import {useMemo} from 'react';
import {
  collection,
  getFirestore,
  onSnapshot,
} from '@react-native-firebase/firestore';
import {reportError} from '../services/ErrorReporter';
import type {SavingsGoal} from '../types';
import {chooseGoals, goalFromDoc, sortGoals} from '../utils/goals';
import {useCached, useUid, useUserData} from './hooks';
import {queryKeys} from './keys';
import {queryClient} from './queryClient';
import {useRetainedListener} from './retainedListener';
import {statusOf, useSyncStore} from './syncStore';

/**
 * The savings goals, read from the goal documents `users/{uid}/goals/{goalId}` through a shared
 * live listener, with the profile's `savingsGoals` array as the fallback while there are no
 * documents yet (a profile not backfilled, or the seconds between an old app's write and the
 * server mirroring it). See src/utils/goals.ts and src/services/GoalsService.ts.
 */

const NO_GOALS: readonly SavingsGoal[] = [];

const goalsListenerId = (uid: string) => `goals:${uid}`;

const startGoalsListener = (uid: string) => () => {
  const id = goalsListenerId(uid);
  const {setStatus} = useSyncStore.getState();
  setStatus(id, 'loading');
  return onSnapshot(
    collection(getFirestore(), 'users', uid, 'goals'),
    snapshot => {
      const goals: SavingsGoal[] = [];
      snapshot.docs.forEach(d => {
        const goal = goalFromDoc(d.id, d.data());
        if (goal) {
          goals.push(goal);
        }
      });
      queryClient.setQueryData(queryKeys.goals(uid), sortGoals(goals));
      setStatus(id, 'live');
    },
    error => {
      reportError(error);
      setStatus(id, 'error');
    },
  );
};

export interface GoalsResult {
  goals: readonly SavingsGoal[];
  /** True until there is something to show. */
  loading: boolean;
  /** True only when a read failed and there is nothing to show. */
  error: boolean;
  /**
   * True once both the profile and the goal documents have been confirmed by their live listeners.
   * A screen that writes from what it shows must wait for this.
   */
  live: boolean;
  /** True when either listener failed. */
  failed: boolean;
  /** True when the profile document itself has loaded (a profile with no goals is still data). */
  hasProfile: boolean;
  retry: () => void;
}

export const useGoals = (): GoalsResult => {
  const uid = useUid();
  const user = useUserData();
  useRetainedListener(
    uid ? goalsListenerId(uid) : null,
    startGoalsListener(uid),
  );
  const status = useSyncStore(state =>
    statusOf(state.statuses, goalsListenerId(uid)),
  );
  const documents = useCached<SavingsGoal[]>(queryKeys.goals(uid), status);
  const array = user.data?.savingsGoals ?? NO_GOALS;
  const goals = useMemo(
    () => chooseGoals(documents.data, array),
    [documents.data, array],
  );
  return {
    goals,
    loading: user.loading || documents.loading,
    error: user.error || documents.error,
    live: user.live && documents.live,
    failed: user.failed || documents.failed,
    hasProfile: user.data !== undefined,
    retry: user.retry,
  };
};
