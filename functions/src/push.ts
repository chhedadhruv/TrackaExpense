import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import type {Fields} from './derive';

/**
 * Sending push notifications. Before this, the app read other users' FCM tokens from their
 * profile documents and posted them to a server that was never deployed. Now the app asks this
 * function, which checks who may be notified, resolves the people to Firebase uids, and sends
 * through OneSignal (devices are linked to the uid with OneSignal.login, so no token ever leaves
 * the device). The OneSignal REST API key exists only as a Firebase secret.
 *
 * Who may be notified: the caller, and the members and pending invitees of a group the caller is
 * a member of. Anyone else in the request is dropped, so this cannot be used to message strangers.
 */

export class PushError extends Error {
  constructor(
    readonly code:
      | 'invalid-argument'
      | 'permission-denied'
      | 'resource-exhausted',
    message: string,
  ) {
    super(message);
  }
}

export const MAX_RECIPIENTS = 50;
export const MAX_CALLS_PER_HOUR = 200;
const MAX_TITLE = 120;
const MAX_BODY = 500;
const MAX_DATA_BYTES = 2048;
const HOUR_MS = 60 * 60 * 1000;
export const ONESIGNAL_URL = 'https://api.onesignal.com/notifications?c=push';

export interface PushInput {
  emails: string[];
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  groupId: string | null;
  icon: string | null;
  priority: string | null;
}

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sameEmail = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

const shortText = (value: unknown, name: string, max: number): string => {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new PushError('invalid-argument', `${name} is missing or too long`);
  }
  return value;
};

export const parsePushInput = (input: unknown): PushInput => {
  if (!isRecord(input)) {
    throw new PushError('invalid-argument', 'expected an object');
  }
  const {emails, data, groupId, icon, priority} = input;
  if (
    !Array.isArray(emails) ||
    emails.length === 0 ||
    emails.length > MAX_RECIPIENTS ||
    emails.some(email => typeof email !== 'string' || !email.includes('@'))
  ) {
    throw new PushError(
      'invalid-argument',
      `emails must be a list of 1 to ${MAX_RECIPIENTS} addresses`,
    );
  }
  const dataObject = data === undefined ? {} : data;
  if (!isRecord(dataObject)) {
    throw new PushError('invalid-argument', 'data must be an object');
  }
  if (JSON.stringify(dataObject).length > MAX_DATA_BYTES) {
    throw new PushError('invalid-argument', 'data is too large');
  }
  if (
    groupId !== undefined &&
    groupId !== null &&
    (typeof groupId !== 'string' || groupId === '' || groupId.includes('/'))
  ) {
    throw new PushError('invalid-argument', 'groupId is invalid');
  }
  return {
    emails: [...new Set((emails as string[]).map(email => email.trim()))],
    type: shortText(input.type, 'type', 40),
    title: shortText(input.title, 'title', MAX_TITLE),
    body: shortText(input.body, 'body', MAX_BODY),
    data: dataObject,
    groupId: typeof groupId === 'string' ? groupId : null,
    icon: typeof icon === 'string' && icon.length <= 16 ? icon : null,
    priority:
      typeof priority === 'string' && priority.length <= 16 ? priority : null,
  };
};

export interface PushCaller {
  uid: string;
  email: string | undefined;
  emailVerified: boolean;
}

export interface PushDeps {
  db: Firestore;
  fetchFn: typeof fetch;
  /** The OneSignal REST API key; undefined when the secret is not set. */
  apiKey: string | undefined;
  appId: string;
  now?: () => number;
}

export interface PushResult {
  /** OneSignal accepted the message. */
  sent: boolean;
  /** The in-app notification was stored instead (OneSignal failed or is not configured). */
  stored: boolean;
  recipients: number;
  skipped: number;
}

/** At most MAX_CALLS_PER_HOUR calls per caller per hour. */
const takeRateToken = async (
  db: Firestore,
  uid: string,
  now: number,
): Promise<void> => {
  const ref = db.collection('pushLimits').doc(uid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const windowStart = snap.exists ? Number(snap.get('windowStart')) : 0;
    const count = snap.exists ? Number(snap.get('count')) : 0;
    if (now - windowStart >= HOUR_MS || !Number.isFinite(windowStart)) {
      tx.set(ref, {windowStart: now, count: 1});
      return;
    }
    if (count >= MAX_CALLS_PER_HOUR) {
      throw new PushError('resource-exhausted', 'Too many notifications.');
    }
    tx.update(ref, {count: count + 1});
  });
};

const findUid = async (
  db: Firestore,
  email: string,
): Promise<string | null> => {
  for (const candidate of [email, email.toLowerCase()]) {
    const result = await db
      .collection('users')
      .where('email', '==', candidate)
      .limit(1)
      .get();
    if (!result.empty) {
      return result.docs[0].id;
    }
  }
  return null;
};

export const sendPush = async (
  deps: PushDeps,
  caller: PushCaller,
  rawInput: unknown,
): Promise<PushResult> => {
  const {db} = deps;
  const input = parsePushInput(rawInput);
  if (!caller.email || !caller.emailVerified) {
    throw new PushError(
      'permission-denied',
      'A verified email address is needed to send notifications.',
    );
  }
  const callerEmail = caller.email;

  // Who the caller may notify: themselves, plus the people of one of their groups.
  const allowed: string[] = [callerEmail];
  if (input.groupId) {
    const group = await db.collection('groups').doc(input.groupId).get();
    const data = (group.data() ?? {}) as Fields;
    const members = Array.isArray(data.members) ? data.members : [];
    if (!group.exists || !members.some(m => sameEmail(m, callerEmail))) {
      throw new PushError('permission-denied', 'You are not in this group.');
    }
    const pending = Array.isArray(data.pendingInvites)
      ? data.pendingInvites
      : [];
    allowed.push(
      ...[...members, ...pending].filter(
        (email): email is string => typeof email === 'string',
      ),
    );
  }
  const recipients = input.emails.filter(email =>
    allowed.some(a => sameEmail(a, email)),
  );
  const skipped = input.emails.length - recipients.length;
  if (recipients.length === 0) {
    throw new PushError(
      'permission-denied',
      'None of these people can be notified.',
    );
  }

  await takeRateToken(db, caller.uid, (deps.now ?? Date.now)());

  const uids = (
    await Promise.all(recipients.map(email => findUid(db, email)))
  ).filter((uid): uid is string => uid !== null);
  if (uids.length === 0) {
    // Nobody with an account to reach.
    return {sent: false, stored: false, recipients: 0, skipped};
  }

  let sent = false;
  if (deps.apiKey) {
    try {
      const response = await deps.fetchFn(ONESIGNAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${deps.apiKey}`,
        },
        body: JSON.stringify({
          app_id: deps.appId,
          target_channel: 'push',
          include_aliases: {external_id: [...new Set(uids)]},
          headings: {en: input.title},
          contents: {en: input.body},
          data: {...input.data, type: input.type},
        }),
      });
      const result = (await response.json().catch(() => ({}))) as Fields;
      sent = response.ok && typeof result.id === 'string' && result.id !== '';
    } catch {
      sent = false;
    }
  }

  let stored = false;
  if (!sent) {
    // Keep an in-app copy so the notification is not lost; the client cannot write these itself.
    const batch = db.batch();
    for (const email of recipients) {
      batch.set(
        db
          .collection('users')
          .doc(email.replace('@', '_at_'))
          .collection('notifications')
          .doc(),
        {
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data,
          ...(input.icon ? {icon: input.icon} : {}),
          ...(input.priority ? {priority: input.priority} : {}),
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        },
      );
    }
    await batch.commit();
    stored = true;
  }
  return {sent, stored, recipients: recipients.length, skipped};
};
