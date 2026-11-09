import {initializeApp} from 'firebase-admin/app';
import {DocumentReference, getFirestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {setGlobalOptions} from 'firebase-functions/v2';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {LookupInputError, lookupUsers} from './lookup';
import {
  SettlementError,
  deleteSettlement as deleteSettlementCore,
  recordSettlement as recordSettlementCore,
} from './settlement';
import {changedFields, type Derived, type Fields} from './derive';
import {deriveForKind, makeLookups, type Kind} from './sources';

/**
 * Keeps the additive minor-unit fields (amountMinor, balanceMinor, ...) in step with the legacy
 * fields. Old installed apps only write the legacy fields, so this is what makes the new fields
 * trustworthy until the new app ships. Every trigger only ever sets new fields, never touches or
 * removes a legacy one, and writes nothing when the document is already up to date (which is also
 * what stops it from triggering itself). The derivation itself lives in sources.ts and is shared
 * with the backfill.
 */

setGlobalOptions({region: 'asia-south1', maxInstances: 3});
initializeApp();
const db = getFirestore();
// No memoization: a user's currency change must be seen by the next trigger.
const lookups = makeLookups(db, false);

const apply = async (
  ref: DocumentReference,
  data: Fields,
  derived: Derived,
): Promise<void> => {
  if (derived.skipped.length > 0) {
    logger.warn('Value could not be derived', {
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
    logger.warn('Could not write minor-unit fields', {
      path: ref.path,
      error: String(error),
    });
  }
};

const onWritten = (document: string, kind: Kind) =>
  onDocumentWritten(document, async event => {
    const after = event.data?.after;
    if (!after || !after.exists) {
      return;
    }
    const data = after.data() as Fields;
    const derived = await deriveForKind(kind, data, event.params.uid, lookups);
    await apply(after.ref, data, derived);
  });

export const minorFromTransaction = onWritten(
  'users/{uid}/transactions/{transactionId}',
  'transaction',
);
export const minorFromSplit = onWritten(
  'groups/{groupId}/splits/{splitId}',
  'split',
);
export const minorFromSettlement = onWritten(
  'groups/{groupId}/settlements/{settlementId}',
  'settlement',
);
export const minorFromIou = onWritten('ious/{iouId}', 'iou');
export const minorFromSavingsHistory = onWritten(
  'users/{uid}/savingsHistory/{entryId}',
  'savingsHistory',
);
export const minorFromUser = onWritten('users/{uid}', 'user');
// memberIds (uids) follows the email list `members`, which old apps keep writing.
export const memberIdsFromGroup = onWritten('groups/{groupId}', 'group');

const settlementCallable = (
  name: string,
  run: typeof recordSettlementCore | typeof deleteSettlementCore,
) =>
  onCall(async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to settle up.');
    }
    try {
      return await run(db, request.auth.uid, request.data);
    } catch (error) {
      if (error instanceof SettlementError) {
        throw new HttpsError(error.code, error.message);
      }
      logger.error(`${name} failed`, {error: String(error)});
      throw new HttpsError('internal', 'The settlement could not be saved.');
    }
  });

/** Records a settlement atomically: documents, both balances and the transactions. */
export const recordSettlement = settlementCallable(
  'recordSettlement',
  recordSettlementCore,
);
/** Deletes a settlement atomically and reverses everything recordSettlement did. */
export const deleteSettlement = settlementCallable(
  'deleteSettlement',
  deleteSettlementCore,
);

/**
 * Finds other users by email or phone and returns only uid, email, name and avatar. Signed-in
 * callers only. This replaces the clients reading other users' profile documents.
 */
export const lookupUsersByContact = onCall(async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to look up users.');
  }
  try {
    return await lookupUsers(db, request.data);
  } catch (error) {
    if (error instanceof LookupInputError) {
      throw new HttpsError('invalid-argument', error.message);
    }
    logger.error('lookupUsersByContact failed', {error: String(error)});
    throw new HttpsError('internal', 'Lookup failed.');
  }
});
