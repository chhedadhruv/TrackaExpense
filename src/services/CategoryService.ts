import {
  collection,
  deleteField,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import {
  PREFS_DOC_ID,
  cleanCategoryName,
  withRenamed,
  withoutValue,
  type CategoryPrefs,
  type CategoryType,
  type CustomCategory,
} from '../utils/customCategories';

/**
 * Writes for the person's own categories (`users/{uid}/categories/{id}`) and their preferences
 * (`users/{uid}/categories/_prefs`). Owner-only data; the existing rules cover it.
 */

/** Below Firestore's 500 writes per batch. */
export const REWRITE_BATCH_SIZE = 400;

const categoriesCol = (uid: string) =>
  collection(getFirestore(), 'users', uid, 'categories');

const prefsRef = (uid: string) =>
  doc(getFirestore(), 'users', uid, 'categories', PREFS_DOC_ID);

/** Adds a category and returns its name as stored. The name must already be checked. */
export const createCategory = async (
  uid: string,
  input: {name: string; type: CategoryType; icon: string},
): Promise<string> => {
  const name = cleanCategoryName(input.name);
  const batch = writeBatch(getFirestore());
  batch.set(doc(categoriesCol(uid)), {
    name,
    type: input.type,
    icon: input.icon,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return name;
};

export const setCategoryIcon = async (
  uid: string,
  id: string,
  icon: string,
): Promise<void> => {
  const batch = writeBatch(getFirestore());
  batch.update(doc(categoriesCol(uid), id), {
    icon,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};

/** Saves the whole preferences document (built from what the live listener confirmed). */
export const savePrefs = async (
  uid: string,
  prefs: CategoryPrefs,
): Promise<void> => {
  const batch = writeBatch(getFirestore());
  batch.set(prefsRef(uid), {
    hidden: prefs.hidden,
    order: prefs.order,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};

/** Deletes a custom category. Past entries keep the name and show the generic icon. */
export const deleteCategory = async (
  uid: string,
  category: CustomCategory,
  prefs: CategoryPrefs,
): Promise<void> => {
  const batch = writeBatch(getFirestore());
  batch.delete(doc(categoriesCol(uid), category.id));
  batch.set(prefsRef(uid), {
    ...withoutValue(prefs, category.type, category.name),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};

type Ref = Awaited<ReturnType<typeof getDocs>>['docs'][number]['ref'];

/** The person's own documents that carry `from` as their category. Shared splits are never read. */
const documentsToRename = async (
  uid: string,
  type: CategoryType,
  from: string,
): Promise<Ref[]> => {
  const db = getFirestore();
  const queries = [
    query(
      collection(db, 'users', uid, 'transactions'),
      where('type', '==', type),
      where('category', '==', from),
    ),
    query(
      collection(db, 'users', uid, 'recurring'),
      where('type', '==', type),
      where('category', '==', from),
    ),
  ];
  if (type === 'expense') {
    queries.push(
      query(
        collection(db, 'users', uid, 'budgets'),
        where('category', '==', from),
      ),
    );
  }
  const snapshots = await Promise.all(queries.map(q => getDocs(q)));
  return snapshots.flatMap(s => s.docs.map((d): Ref => d.ref));
};

/**
 * Moves every one of the person's transactions, recurring rules and budgets from category `from`
 * to `to`, in batches. Only `category` changes: no money field and no balance is touched.
 * Returns how many documents changed. Running it again is harmless (nothing is left to change).
 */
export const rewriteCategory = async (
  uid: string,
  type: CategoryType,
  from: string,
  to: string,
): Promise<number> => {
  const refs = await documentsToRename(uid, type, from);
  for (let i = 0; i < refs.length; i += REWRITE_BATCH_SIZE) {
    const batch = writeBatch(getFirestore());
    refs
      .slice(i, i + REWRITE_BATCH_SIZE)
      .forEach(ref => batch.update(ref, {category: to}));
    await batch.commit();
  }
  return refs.length;
};

/**
 * Renames a custom category and moves the person's past entries to the new name. The category
 * keeps `renamingFrom` (the old name) until every entry is moved, so an interrupted rename can be
 * finished with `finishRename`. Returns how many entries were moved.
 */
export const renameCategory = async (
  uid: string,
  category: CustomCategory,
  newName: string,
  prefs: CategoryPrefs,
): Promise<number> => {
  const to = cleanCategoryName(newName);
  const from = category.name;
  const batch = writeBatch(getFirestore());
  batch.update(doc(categoriesCol(uid), category.id), {
    name: to,
    renamingFrom: from,
    updatedAt: serverTimestamp(),
  });
  batch.set(prefsRef(uid), {
    ...withRenamed(prefs, category.type, from, to),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return finishRename(uid, {...category, name: to, renamingFrom: from});
};

/** Finishes a rename that was interrupted (see `renameCategory`). Returns how many entries moved. */
export const finishRename = async (
  uid: string,
  category: CustomCategory,
): Promise<number> => {
  if (!category.renamingFrom) {
    return 0;
  }
  const moved = await rewriteCategory(
    uid,
    category.type,
    category.renamingFrom,
    category.name,
  );
  const batch = writeBatch(getFirestore());
  batch.update(doc(categoriesCol(uid), category.id), {
    renamingFrom: deleteField(),
  });
  await batch.commit();
  return moved;
};
