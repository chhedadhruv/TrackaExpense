import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import {parseBudgetDoc, type BudgetDocument} from '../utils/budgets';

/**
 * The user's budgets, `users/{uid}/budgets/{id}` (owner-only, like tags). The alerts that follow
 * from them are written by the server into `budgetAlerts`; the app never writes those.
 */

/** Every budget of the user; documents that cannot be used are skipped. Oldest first. */
export const loadBudgets = async (uid: string): Promise<BudgetDocument[]> => {
  const snapshot = await getDocs(
    collection(getFirestore(), 'users', uid, 'budgets'),
  );
  const budgets: {budget: BudgetDocument; created: number}[] = [];
  snapshot.docs.forEach(d => {
    const budget = parseBudgetDoc(d.id, d.data());
    if (budget) {
      const created = d.data()?.createdAt;
      budgets.push({
        budget,
        created:
          typeof created?.toMillis === 'function' ? created.toMillis() : 0,
      });
    }
  });
  return budgets.sort((a, b) => a.created - b.created).map(b => b.budget);
};

/** Creates a budget (no id) or replaces the fields of an existing one. Returns its id. */
export const saveBudget = async (
  uid: string,
  id: string | null,
  data: Omit<BudgetDocument, 'id'>,
): Promise<string> => {
  const db = getFirestore();
  if (id === null) {
    const ref = doc(collection(db, 'users', uid, 'budgets'));
    await setDoc(ref, {...data, createdAt: serverTimestamp()});
    return ref.id;
  }
  await updateDoc(doc(db, 'users', uid, 'budgets', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  return id;
};

export const deleteBudget = async (uid: string, id: string): Promise<void> => {
  await deleteDoc(doc(getFirestore(), 'users', uid, 'budgets', id));
};
