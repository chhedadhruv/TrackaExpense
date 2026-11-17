import {
  doc,
  getFirestore,
  runTransaction,
} from '@react-native-firebase/firestore';
import type {SavingsGoal} from '../types';
import {goalCurrency, goalDocFields, rebaseGoals} from '../utils/goals';

/**
 * Saves a change to the savings goals in the two places they live, in one transaction.
 *
 * `previous` is the list the screen showed and `next` the list after the user's edit. The
 * transaction reads the profile's goals array as the server holds it right now and applies only
 * the difference between the two lists to it (`rebaseGoals`), so a goal changed from another device
 * in the meantime is not overwritten by this screen's older copy. It then writes the array (what old
 * installed apps read) and the goal documents `users/{uid}/goals/{goalId}` (what this app reads)
 * together: both change or neither does. Nothing is written when nothing changed.
 */
export const saveGoals = async (
  uid: string,
  previous: readonly SavingsGoal[],
  next: readonly SavingsGoal[],
): Promise<void> => {
  const db = getFirestore();
  const userRef = doc(db, 'users', uid);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(userRef);
    const data = (snapshot.data() ?? {}) as {
      savingsGoals?: SavingsGoal[];
      currency?: unknown;
    };
    const fresh = Array.isArray(data.savingsGoals) ? data.savingsGoals : [];
    const {goals, upserts, deletes} = rebaseGoals(fresh, previous, next);
    if (upserts.length === 0 && deletes.length === 0) {
      return;
    }
    const currency = goalCurrency(data.currency);
    transaction.update(userRef, {savingsGoals: goals});
    for (const goal of upserts) {
      transaction.set(
        doc(db, 'users', uid, 'goals', goal.id),
        goalDocFields(goal, currency),
      );
    }
    for (const id of deletes) {
      transaction.delete(doc(db, 'users', uid, 'goals', id));
    }
  });
};
