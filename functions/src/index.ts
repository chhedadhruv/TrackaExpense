import {initializeApp} from 'firebase-admin/app';
import {
  DocumentReference,
  getFirestore,
  type Firestore,
} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {setGlobalOptions} from 'firebase-functions/v2';
import {defineSecret} from 'firebase-functions/params';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {runRecurring} from './recurringJob';
import {
  InvitationError,
  respondToInvitation as respondToInvitationCore,
} from './invitation';
import {evaluateBudgets} from './budgetAlerts';
import {
  InviteLinkError,
  createInviteLink,
  joinGroupByLink as joinGroupByLinkCore,
  previewInviteLink,
  revokeInviteLinks,
  type CallerIdentity as InviteLinkCaller,
} from './inviteLinks';
import {mirrorGoals} from './goalsSync';
import {crossedTarget, notifyGoalReached} from './goalReached';
import {LookupInputError, lookupUsers} from './lookup';
import {isFlagOn} from './remoteFlag';
import {PushError, sendPush as sendPushCore} from './push';
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

// The OneSignal REST API key lives only in Secret Manager (firebase functions:secrets:set).
const oneSignalApiKey = defineSecret('ONESIGNAL_API_KEY');
// The app id is public (it is also in the app); only the REST API key is secret.
const ONESIGNAL_APP_ID = '5dc1c59a-d523-4725-8434-d7ea90803d29';

/**
 * Sends a push notification through OneSignal to the caller or to people in one of the caller's
 * groups. This replaces the app reading other users' FCM tokens.
 */
export const sendPush = onCall({secrets: [oneSignalApiKey]}, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to send notifications.');
  }
  const token = request.auth.token;
  try {
    return await sendPushCore(
      {
        db,
        fetchFn: fetch,
        // Not set (for example in the emulator): the function stores the in-app copy only.
        apiKey: process.env.ONESIGNAL_API_KEY || undefined,
        appId: ONESIGNAL_APP_ID,
      },
      {
        uid: request.auth.uid,
        email: token.email,
        emailVerified: token.email_verified === true,
      },
      request.data,
    );
  } catch (error) {
    if (error instanceof PushError) {
      throw new HttpsError(error.code, error.message);
    }
    logger.error('sendPush failed', {error: String(error)});
    throw new HttpsError('internal', 'The notification could not be sent.');
  }
});

/** Accepts or declines a group invitation addressed to the (verified) caller. */
export const respondToInvitation = onCall(async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to answer an invitation.');
  }
  const token = request.auth.token;
  try {
    return await respondToInvitationCore(
      db,
      {
        uid: request.auth.uid,
        email: token.email,
        emailVerified: token.email_verified === true,
        name: typeof token.name === 'string' ? token.name : undefined,
      },
      request.data,
    );
  } catch (error) {
    if (error instanceof InvitationError) {
      throw new HttpsError(error.code, error.message);
    }
    logger.error('respondToInvitation failed', {error: String(error)});
    throw new HttpsError('internal', 'The invitation could not be answered.');
  }
});

type InviteLinkRun = (
  db: Firestore,
  caller: InviteLinkCaller,
  input: unknown,
) => Promise<unknown>;

const inviteLinkCallable = (name: string, run: InviteLinkRun) =>
  onCall(async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use invite links.');
    }
    const token = request.auth.token;
    try {
      return await run(
        db,
        {
          uid: request.auth.uid,
          email: token.email,
          emailVerified: token.email_verified === true,
          name: typeof token.name === 'string' ? token.name : undefined,
        },
        request.data,
      );
    } catch (error) {
      if (error instanceof InviteLinkError) {
        throw new HttpsError(error.code, error.message);
      }
      logger.error(`${name} failed`, {error: String(error)});
      throw new HttpsError('internal', 'The invite link could not be used.');
    }
  });

/** Makes an invite link (a random token, stored as a hash) for a group the caller is in. */
export const createGroupInviteLink = inviteLinkCallable(
  'createGroupInviteLink',
  createInviteLink,
);
/** The group name and size behind a link, for the confirm screen. */
export const previewGroupInviteLink = inviteLinkCallable(
  'previewGroupInviteLink',
  previewInviteLink,
);
/** Joins the caller to the group the link belongs to, in one transaction. */
export const joinGroupByLink = inviteLinkCallable(
  'joinGroupByLink',
  joinGroupByLinkCore,
);
/** Cancels the caller's links of a group (every link of the group for its creator). */
export const revokeGroupInviteLinks = inviteLinkCallable(
  'revokeGroupInviteLinks',
  revokeInviteLinks,
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

/**
 * Budget alerts: after a transaction is written, checks the owner's budgets and records and pushes
 * one alert per threshold and period (see budgetAlerts.ts). Off unless the Remote Config flag
 * `enable_budgets` is "true". A transaction without `amountMinor` is skipped; the money trigger
 * adds it and that second write comes through here again.
 */
export const budgetAlertsOnTransaction = onDocumentWritten(
  {
    document: 'users/{uid}/transactions/{transactionId}',
    secrets: [oneSignalApiKey],
  },
  async event => {
    const after = event.data?.after;
    if (!after || !after.exists) {
      return;
    }
    const data = after.data() as Fields;
    if (data.type !== 'expense' || typeof data.amountMinor !== 'number') {
      return;
    }
    if (!(await isFlagOn('enable_budgets'))) {
      return;
    }
    try {
      await evaluateBudgets(
        {
          db,
          fetchFn: fetch,
          apiKey: process.env.ONESIGNAL_API_KEY || undefined,
          appId: ONESIGNAL_APP_ID,
        },
        event.params.uid,
      );
    } catch (error) {
      logger.error('Budget evaluation failed', {
        uid: event.params.uid,
        error: String(error),
      });
    }
  },
);

/**
 * "Savings goal reached": when a goal document goes from below its target to at or above it, records
 * one alert and sends one push (see goalReached.ts). Off unless the Remote Config flag
 * `enable_goal_reached` is "true".
 */
export const goalReachedOnGoal = onDocumentWritten(
  {
    document: 'users/{uid}/goals/{goalId}',
    secrets: [oneSignalApiKey],
  },
  async event => {
    const after = event.data?.after;
    if (!after || !after.exists) {
      return;
    }
    const before = event.data?.before;
    const afterData = after.data() as Fields;
    const beforeData = before?.exists ? (before.data() as Fields) : undefined;
    if (!crossedTarget(beforeData, afterData)) {
      return;
    }
    if (!(await isFlagOn('enable_goal_reached'))) {
      return;
    }
    try {
      await notifyGoalReached(
        {
          db,
          fetchFn: fetch,
          apiKey: process.env.ONESIGNAL_API_KEY || undefined,
          appId: ONESIGNAL_APP_ID,
        },
        event.params.uid,
        event.params.goalId,
        afterData,
        event.id,
      );
    } catch (error) {
      logger.error('Goal reached alert failed', {
        uid: event.params.uid,
        goalId: event.params.goalId,
        error: String(error),
      });
    }
  },
);

/**
 * Recurring transactions: every hour (so every time zone gets its own "today") creates the
 * transactions that are due, once each, and adjusts the owner's balance in the same Firestore
 * transaction (see recurringJob.ts). Off unless the Remote Config flag `enable_recurring` is
 * "true". Needs Cloud Scheduler and a collection-group index on recurring.nextDueDate to deploy.
 */
export const runRecurringTransactions = onSchedule(
  {schedule: 'every 1 hours', timeZone: 'UTC', secrets: [oneSignalApiKey]},
  async () => {
    if (!(await isFlagOn('enable_recurring'))) {
      return;
    }
    const result = await runRecurring({
      db,
      fetchFn: fetch,
      apiKey: process.env.ONESIGNAL_API_KEY || undefined,
      appId: ONESIGNAL_APP_ID,
    });
    logger.info('Recurring run finished', {
      rules: result.rules,
      created: result.created.length,
      skipped: result.skipped,
      failed: result.failed,
    });
  },
);

/**
 * Savings goals: old installed apps still write the whole `savingsGoals` array on the user document.
 * This mirrors what changed in it into `users/{uid}/goals/{goalId}`, the documents the new app
 * reads (see goals.ts and goalsSync.ts). It only acts when the array itself changed, so the many
 * other writes to the user document (balance, profile) cost one comparison and nothing else.
 */
export const goalsFromUser = onDocumentWritten('users/{uid}', async event => {
  const after = event.data?.after;
  if (!after || !after.exists) {
    return;
  }
  const afterData = after.data() as Fields;
  const before = event.data?.before;
  const beforeGoals = before?.exists
    ? (before.data() as Fields).savingsGoals
    : undefined;
  if (!Array.isArray(afterData.savingsGoals) && !Array.isArray(beforeGoals)) {
    return;
  }
  try {
    await mirrorGoals(
      db,
      event.params.uid,
      beforeGoals,
      afterData.savingsGoals,
      afterData.currency,
    );
  } catch (error) {
    logger.error('Could not mirror savings goals', {
      uid: event.params.uid,
      error: String(error),
    });
  }
});
