import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import {cleanTag, tagDocId, unknownTags} from '../utils/tags';

/**
 * The user's own tag list, `users/{uid}/tags/{t_<lowercased tag>}` with `name` (as first typed),
 * `createdAt` and `lastUsedAt`. It exists so the form can suggest every tag the user ever used,
 * not only the ones on the transactions loaded on screen. The transactions themselves carry the
 * tags (`tags: string[]`); this list is only for suggestions, so a missing or stale list never
 * loses data.
 */

/** Enough for suggestions without reading an unbounded collection. */
const MAX_TAGS_LOADED = 100;

/** The user's tags, most recently used first. Documents without a usable name are skipped. */
export const loadUserTags = async (uid: string): Promise<string[]> => {
  const snapshot = await getDocs(
    query(
      collection(getFirestore(), 'users', uid, 'tags'),
      orderBy('lastUsedAt', 'desc'),
      limit(MAX_TAGS_LOADED),
    ),
  );
  const names: string[] = [];
  snapshot.docs.forEach(d => {
    const name = d.data()?.name;
    if (typeof name === 'string' && cleanTag(name)) {
      names.push(cleanTag(name));
    }
  });
  return names;
};

/**
 * Records that these tags were just used: new ones are added to the list, known ones only get a
 * fresh `lastUsedAt` (their stored spelling is kept). One batch, nothing to do for no tags.
 */
export const recordTagUse = async (
  uid: string,
  selected: readonly string[],
  known: readonly string[],
): Promise<void> => {
  if (selected.length === 0) {
    return;
  }
  const db = getFirestore();
  const fresh = new Set(unknownTags(selected, known).map(tagDocId));
  const batch = writeBatch(db);
  selected.forEach(tag => {
    const id = tagDocId(tag);
    batch.set(
      doc(db, 'users', uid, 'tags', id),
      fresh.has(id)
        ? {
            name: cleanTag(tag),
            createdAt: serverTimestamp(),
            lastUsedAt: serverTimestamp(),
          }
        : {lastUsedAt: serverTimestamp()},
      {merge: true},
    );
  });
  await batch.commit();
};
