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
import {parseRecurringDoc, type RecurringDocument} from '../utils/recurring';

/**
 * The user's recurring rules, `users/{uid}/recurring/{id}` (owner-only, like tags and budgets).
 * The app only edits rules; the transactions they produce are created by the scheduled function
 * on the server, which also moves `nextDueDate`, `lastRunAt` and `finished`.
 */

export type RecurringInput = Omit<RecurringDocument, 'id' | 'finished'>;

/** Every rule of the user, soonest next date first; unusable documents are skipped. */
export const loadRecurring = async (
  uid: string,
): Promise<RecurringDocument[]> => {
  const snapshot = await getDocs(
    collection(getFirestore(), 'users', uid, 'recurring'),
  );
  const rules: RecurringDocument[] = [];
  snapshot.docs.forEach(d => {
    const rule = parseRecurringDoc(d.id, d.data());
    if (rule) {
      rules.push(rule);
    }
  });
  return rules.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
};

/** Creates a rule (no id) or updates an existing one. Returns its id. */
export const saveRecurring = async (
  uid: string,
  id: string | null,
  data: RecurringInput,
): Promise<string> => {
  const db = getFirestore();
  if (id === null) {
    const ref = doc(collection(db, 'users', uid, 'recurring'));
    await setDoc(ref, {...data, finished: false, createdAt: serverTimestamp()});
    return ref.id;
  }
  // `finished` is cleared so a rule whose end date was moved out can run again; the server sets it
  // again if the end date has really passed.
  await updateDoc(doc(db, 'users', uid, 'recurring', id), {
    ...data,
    finished: false,
    updatedAt: serverTimestamp(),
  });
  return id;
};

/** Deletes a rule. Transactions it already created stay. */
export const deleteRecurring = async (
  uid: string,
  id: string,
): Promise<void> => {
  await deleteDoc(doc(getFirestore(), 'users', uid, 'recurring', id));
};
