import {initializeApp} from 'firebase-admin/app';
import {DocumentReference, getFirestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {setGlobalOptions} from 'firebase-functions/v2';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {
  changedFields,
  deriveAmountDocument,
  deriveSavingsHistory,
  deriveTransaction,
  deriveUser,
  type Derived,
  type Fields,
} from './derive';

/**
 * Keeps the additive minor-unit fields (amountMinor, balanceMinor, ...) in step with the legacy
 * fields. Old installed apps only write the legacy fields, so this is what makes the new fields
 * trustworthy until the new app ships. Every trigger only ever sets new fields, never touches or
 * removes a legacy one, and writes nothing when the document is already up to date (which is also
 * what stops it from triggering itself).
 */

setGlobalOptions({region: 'asia-south1', maxInstances: 3});
initializeApp();
const db = getFirestore();

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !value.includes('/');

/** Currency set on a user's profile, or undefined (the caller falls back to the default). */
const currencyOfUser = async (uid: unknown): Promise<unknown> => {
  if (!isId(uid)) {
    return undefined;
  }
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.get('currency') : undefined;
};

const currencyOfEmail = async (email: unknown): Promise<unknown> => {
  if (typeof email !== 'string' || email.trim() === '') {
    return undefined;
  }
  const result = await db
    .collection('users')
    .where('email', '==', email.trim())
    .limit(1)
    .get();
  return result.empty ? undefined : result.docs[0].get('currency');
};

const userIdOf = (value: unknown): unknown =>
  typeof value === 'object' && value !== null
    ? (value as Fields).userId
    : undefined;

const apply = async (
  ref: DocumentReference,
  data: Fields,
  derived: Derived,
): Promise<void> => {
  if (derived.skipped.length > 0) {
    logger.warn('Value could not be converted to minor units', {
      path: ref.path,
      skipped: derived.skipped,
    });
  }
  const changed = changedFields(data, derived.fields);
  if (!changed) {
    return;
  }
  try {
    await ref.update(changed);
  } catch (error) {
    // The document may have been deleted since the event; there is nothing to repair then.
    logger.error('Could not write minor-unit fields', {
      path: ref.path,
      error: String(error),
    });
  }
};

const onWritten = (
  document: string,
  derive: (data: Fields, params: Record<string, string>) => Promise<Derived>,
) =>
  onDocumentWritten(document, async event => {
    const after = event.data?.after;
    if (!after || !after.exists) {
      return;
    }
    const data = after.data() as Fields;
    await apply(after.ref, data, await derive(data, event.params));
  });

export const minorFromTransaction = onWritten(
  'users/{uid}/transactions/{transactionId}',
  async (data, params) =>
    deriveTransaction(data, await currencyOfUser(params.uid)),
);

export const minorFromSplit = onWritten(
  'groups/{groupId}/splits/{splitId}',
  async data =>
    deriveAmountDocument(data, await currencyOfUser(userIdOf(data.paidBy))),
);

export const minorFromSettlement = onWritten(
  'groups/{groupId}/settlements/{settlementId}',
  async data =>
    deriveAmountDocument(
      data,
      await currencyOfUser(userIdOf(data.from) ?? userIdOf(data.to)),
    ),
);

export const minorFromIou = onWritten('ious/{iouId}', async data =>
  deriveAmountDocument(data, await currencyOfEmail(data.fromEmail)),
);

export const minorFromSavingsHistory = onWritten(
  'users/{uid}/savingsHistory/{entryId}',
  async (data, params) =>
    deriveSavingsHistory(data, await currencyOfUser(params.uid)),
);

export const minorFromUser = onWritten('users/{uid}', async data =>
  deriveUser(data),
);
