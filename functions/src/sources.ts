import type {Firestore} from 'firebase-admin/firestore';
import {
  deriveAmountDocument,
  deriveGroup,
  deriveSavingsHistory,
  deriveTransaction,
  deriveUser,
  type Derived,
  type Fields,
} from './derive';

/**
 * The single place that decides how each kind of document is derived. The triggers and the
 * backfill both go through deriveForKind, so they can never disagree about the same document.
 */

export type Kind =
  | 'user'
  | 'transaction'
  | 'split'
  | 'settlement'
  | 'iou'
  | 'savingsHistory'
  | 'group';

export interface Lookups {
  /** uid of the user with this email (exact match first, then lower case), or undefined. */
  uidOfEmail(email: unknown): Promise<string | undefined>;
  /** Currency on a user's profile, or undefined. */
  currencyOfUser(uid: unknown): Promise<unknown>;
  /** Currency of the user with this exact email, or undefined. */
  currencyOfEmail(email: unknown): Promise<unknown>;
}

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !value.includes('/');

const userIdOf = (value: unknown): unknown =>
  typeof value === 'object' && value !== null
    ? (value as Fields).userId
    : undefined;

/**
 * Firestore-backed lookups. Triggers use memoize=false so a user's currency change is seen
 * immediately; the backfill uses memoize=true to read each user once.
 */
export const makeLookups = (db: Firestore, memoize: boolean): Lookups => {
  const byUid = new Map<string, unknown>();
  const byEmail = new Map<string, unknown>();
  const uidByEmail = new Map<string, string | undefined>();

  const findUid = async (email: string): Promise<string | undefined> => {
    const result = await db
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    return result.empty ? undefined : result.docs[0].id;
  };

  return {
    async uidOfEmail(email) {
      if (typeof email !== 'string' || email.trim() === '') {
        return undefined;
      }
      const key = email.trim();
      if (memoize && uidByEmail.has(key)) {
        return uidByEmail.get(key);
      }
      let uid = await findUid(key);
      if (uid === undefined && key !== key.toLowerCase()) {
        uid = await findUid(key.toLowerCase());
      }
      if (memoize) {
        uidByEmail.set(key, uid);
      }
      return uid;
    },
    async currencyOfUser(uid) {
      if (!isId(uid)) {
        return undefined;
      }
      if (memoize && byUid.has(uid)) {
        return byUid.get(uid);
      }
      const snap = await db.collection('users').doc(uid).get();
      const currency = snap.exists ? snap.get('currency') : undefined;
      if (memoize) {
        byUid.set(uid, currency);
      }
      return currency;
    },
    async currencyOfEmail(email) {
      if (typeof email !== 'string' || email.trim() === '') {
        return undefined;
      }
      const key = email.trim();
      if (memoize && byEmail.has(key)) {
        return byEmail.get(key);
      }
      const result = await db
        .collection('users')
        .where('email', '==', key)
        .limit(1)
        .get();
      const currency = result.empty
        ? undefined
        : result.docs[0].get('currency');
      if (memoize) {
        byEmail.set(key, currency);
      }
      return currency;
    },
  };
};

/** Derives the additive fields for one document. `uid` is the owner for users/{uid}/... paths. */
export const deriveForKind = async (
  kind: Kind,
  data: Fields,
  uid: string | undefined,
  lookups: Lookups,
): Promise<Derived> => {
  switch (kind) {
    case 'group': {
      const members = Array.isArray(data.members) ? data.members : [];
      const uids: Array<string | undefined> = [];
      for (const email of members) {
        uids.push(await lookups.uidOfEmail(email));
      }
      return deriveGroup(data, uids);
    }
    case 'user':
      return deriveUser(data);
    case 'transaction':
      return deriveTransaction(data, await lookups.currencyOfUser(uid));
    case 'savingsHistory':
      return deriveSavingsHistory(data, await lookups.currencyOfUser(uid));
    case 'split':
      return deriveAmountDocument(
        data,
        await lookups.currencyOfUser(userIdOf(data.paidBy)),
      );
    case 'settlement':
      return deriveAmountDocument(
        data,
        await lookups.currencyOfUser(userIdOf(data.from) ?? userIdOf(data.to)),
      );
    case 'iou':
      return deriveAmountDocument(
        data,
        await lookups.currencyOfEmail(data.fromEmail),
      );
  }
};
