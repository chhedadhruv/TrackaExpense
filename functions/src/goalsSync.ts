import type {Firestore} from 'firebase-admin/firestore';
import type {Fields} from './derive';
import {goalDocUpToDate, planGoalSync} from './goals';

export interface MirrorResult {
  written: number;
  deleted: number;
}

/**
 * Brings `users/{uid}/goals` in line with a change of the `savingsGoals` array from `before` to
 * `after` (see goals.ts for the rules). A document that already equals what the array says is left
 * alone, so the new app, which writes the goal document and the array in one transaction, causes no
 * extra writes here. Safe to run any number of times.
 */
export const mirrorGoals = async (
  db: Firestore,
  uid: string,
  before: unknown,
  after: unknown,
  currency: unknown,
): Promise<MirrorResult> => {
  const result: MirrorResult = {written: 0, deleted: 0};
  const plan = planGoalSync(before, after, currency);
  if (plan.upserts.length === 0 && plan.deletes.length === 0) {
    return result;
  }
  const goals = db.collection('users').doc(uid).collection('goals');
  const refs = plan.upserts.map(u => goals.doc(u.id));
  const existing = refs.length > 0 ? await db.getAll(...refs) : [];
  const batch = db.batch();
  plan.upserts.forEach((upsert, i) => {
    const snap = existing[i];
    if (snap.exists && goalDocUpToDate(snap.data() as Fields, upsert.fields)) {
      return;
    }
    batch.set(refs[i], upsert.fields);
    result.written += 1;
  });
  for (const id of plan.deletes) {
    batch.delete(goals.doc(id));
    result.deleted += 1;
  }
  if (result.written + result.deleted > 0) {
    await batch.commit();
  }
  return result;
};
