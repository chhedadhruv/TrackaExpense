import {createHash, randomBytes} from 'node:crypto';
import {FieldValue, Timestamp, type Firestore} from 'firebase-admin/firestore';
import type {Fields} from './derive';

/**
 * Invite links: a member makes a link, anyone who opens it (signed in, verified email) can join the
 * group after a confirm screen. The link carries a random token; only the SHA-256 of the token is
 * stored (`groupInvites/{hash}`), so a leaked database does not hand out usable links. All of it
 * goes through callables: the client never reads or writes `groupInvites`.
 *
 * Joining adds the caller's email (from the verified sign-in token, never the editable profile
 * field) to the group's `members`, exactly what accepting an invitation does, so old installed apps
 * see a normal member and the `memberIds` trigger fills in the uid.
 */

export class InviteLinkError extends Error {
  constructor(
    readonly code:
      | 'invalid-argument'
      | 'not-found'
      | 'permission-denied'
      | 'failed-precondition'
      | 'resource-exhausted',
    message: string,
  ) {
    super(message);
  }
}

export interface CallerIdentity {
  uid: string;
  /** Email from the verified sign-in token, or undefined. */
  email: string | undefined;
  emailVerified: boolean;
  /** Display name from the sign-in token, or undefined. */
  name: string | undefined;
}

export const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Links that are neither revoked nor expired, per group. */
export const MAX_ACTIVE_LINKS_PER_GROUP = 20;
/** A group reached through links stops growing here. */
export const MAX_GROUP_MEMBERS = 50;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** 128 random bits, URL safe (22 characters). */
export const newToken = (): string => randomBytes(16).toString('base64url');

/** The stored identity of a token. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface Deps {
  now?: () => number;
  token?: () => string;
}

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const sameEmail = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !value.includes('/');

export const parseGroupInput = (input: unknown): {groupId: string} => {
  if (!isRecord(input) || !isId(input.groupId)) {
    throw new InviteLinkError('invalid-argument', 'groupId is required');
  }
  return {groupId: input.groupId};
};

export const parseLinkInput = (
  input: unknown,
): {groupId: string; token: string} => {
  if (
    !isRecord(input) ||
    !isId(input.groupId) ||
    typeof input.token !== 'string' ||
    !TOKEN_PATTERN.test(input.token)
  ) {
    throw new InviteLinkError(
      'invalid-argument',
      'groupId and a valid token are required',
    );
  }
  return {groupId: input.groupId, token: input.token};
};

const requireVerified = (caller: CallerIdentity): string => {
  if (!caller.email || !caller.emailVerified) {
    throw new InviteLinkError(
      'permission-denied',
      'A verified email address is needed to use invite links.',
    );
  }
  return caller.email;
};

const isMember = (group: Fields, caller: CallerIdentity): boolean => {
  const members = Array.isArray(group.members) ? group.members : [];
  const ids = Array.isArray(group.memberIds) ? group.memberIds : [];
  return (
    members.some(m => sameEmail(m, caller.email)) || ids.includes(caller.uid)
  );
};

const millis = (value: unknown): number | null =>
  value instanceof Timestamp ? value.toMillis() : null;

const checkLink = (
  link: Fields | undefined,
  groupId: string,
  nowMs: number,
): Fields => {
  if (!link || link.groupId !== groupId) {
    throw new InviteLinkError('not-found', 'This invite link is not valid.');
  }
  if (link.revoked === true) {
    throw new InviteLinkError(
      'failed-precondition',
      'This invite link was cancelled.',
    );
  }
  const expires = millis(link.expiresAt);
  if (expires === null || expires <= nowMs) {
    throw new InviteLinkError(
      'failed-precondition',
      'This invite link has expired.',
    );
  }
  return link;
};

export interface CreateResult {
  token: string;
  groupId: string;
  expiresAtMs: number;
}

/** Makes a link for a group the caller belongs to. */
export const createInviteLink = async (
  db: Firestore,
  caller: CallerIdentity,
  rawInput: unknown,
  deps: Deps = {},
): Promise<CreateResult> => {
  const {groupId} = parseGroupInput(rawInput);
  requireVerified(caller);
  const nowMs = (deps.now ?? Date.now)();
  const groupSnap = await db.collection('groups').doc(groupId).get();
  if (!groupSnap.exists) {
    throw new InviteLinkError('not-found', 'Group not found.');
  }
  if (!isMember(groupSnap.data() as Fields, caller)) {
    throw new InviteLinkError(
      'permission-denied',
      'Only a member of the group can make an invite link.',
    );
  }
  const existing = await db
    .collection('groupInvites')
    .where('groupId', '==', groupId)
    .get();
  const active = existing.docs.filter(d => {
    const data = d.data();
    return data.revoked !== true && (millis(data.expiresAt) ?? 0) > nowMs;
  }).length;
  if (active >= MAX_ACTIVE_LINKS_PER_GROUP) {
    throw new InviteLinkError(
      'resource-exhausted',
      'This group has too many active invite links. Cancel some first.',
    );
  }
  const token = (deps.token ?? newToken)();
  const expiresAtMs = nowMs + LINK_TTL_MS;
  await db
    .collection('groupInvites')
    .doc(hashToken(token))
    .create({
      groupId,
      createdByUid: caller.uid,
      createdAt: Timestamp.fromMillis(nowMs),
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      revoked: false,
      uses: 0,
    });
  return {token, groupId, expiresAtMs};
};

export interface PreviewResult {
  groupId: string;
  groupName: string;
  memberCount: number;
  alreadyMember: boolean;
  expiresAtMs: number;
}

/** What the confirm screen shows: the group's name and size, nothing about who is in it. */
export const previewInviteLink = async (
  db: Firestore,
  caller: CallerIdentity,
  rawInput: unknown,
  deps: Deps = {},
): Promise<PreviewResult> => {
  const {groupId, token} = parseLinkInput(rawInput);
  const nowMs = (deps.now ?? Date.now)();
  const linkSnap = await db
    .collection('groupInvites')
    .doc(hashToken(token))
    .get();
  const link = checkLink(
    linkSnap.exists ? (linkSnap.data() as Fields) : undefined,
    groupId,
    nowMs,
  );
  const groupSnap = await db.collection('groups').doc(groupId).get();
  if (!groupSnap.exists) {
    throw new InviteLinkError('not-found', 'This group no longer exists.');
  }
  const group = groupSnap.data() as Fields;
  const members = Array.isArray(group.members) ? group.members : [];
  return {
    groupId,
    groupName: text(group.name) ?? 'a group',
    memberCount: members.length,
    alreadyMember: isMember(group, caller),
    expiresAtMs: millis(link.expiresAt) ?? 0,
  };
};

export interface JoinResult {
  status: 'joined' | 'already-member';
  groupId: string;
}

/** Adds the caller to the group, in one transaction. Harmless when repeated. */
export const joinGroupByLink = async (
  db: Firestore,
  caller: CallerIdentity,
  rawInput: unknown,
  deps: Deps = {},
): Promise<JoinResult> => {
  const {groupId, token} = parseLinkInput(rawInput);
  const callerEmail = requireVerified(caller);
  const linkRef = db.collection('groupInvites').doc(hashToken(token));
  const groupRef = db.collection('groups').doc(groupId);
  const userRef = db.collection('users').doc(caller.uid);
  const invitationsQuery = db
    .collection('invitations')
    .where('groupId', '==', groupId)
    .where('status', '==', 'pending');

  return db.runTransaction(async tx => {
    const nowMs = (deps.now ?? Date.now)();
    const [linkSnap, groupSnap, userSnap, invitations] = await Promise.all([
      tx.get(linkRef),
      tx.get(groupRef),
      tx.get(userRef),
      tx.get(invitationsQuery),
    ]);
    checkLink(
      linkSnap.exists ? (linkSnap.data() as Fields) : undefined,
      groupId,
      nowMs,
    );
    if (!groupSnap.exists) {
      throw new InviteLinkError('not-found', 'This group no longer exists.');
    }
    const group = groupSnap.data() as Fields;
    if (isMember(group, caller)) {
      return {status: 'already-member', groupId};
    }
    const members: unknown[] = Array.isArray(group.members)
      ? [...group.members]
      : [];
    if (members.length >= MAX_GROUP_MEMBERS) {
      throw new InviteLinkError('failed-precondition', 'This group is full.');
    }
    members.push(callerEmail);
    const pending = (
      Array.isArray(group.pendingInvites) ? group.pendingInvites : []
    ).filter(email => !sameEmail(email, callerEmail));
    const profile = (userSnap.data() ?? {}) as Fields;
    const name =
      text(profile.name) ??
      text(profile.displayName) ??
      text(caller.name) ??
      callerEmail;
    tx.update(groupRef, {
      members,
      memberNames: {
        ...(isRecord(group.memberNames) ? group.memberNames : {}),
        [callerEmail]: name,
      },
      pendingInvites: pending,
      updatedAt: FieldValue.serverTimestamp(),
    });
    // An email invitation to the same group is now answered.
    for (const doc of invitations.docs) {
      if (sameEmail(doc.get('email'), callerEmail)) {
        tx.update(doc.ref, {
          status: 'accepted',
          respondedAt: Timestamp.fromMillis(nowMs),
        });
      }
    }
    tx.update(linkRef, {
      uses: FieldValue.increment(1),
      lastUsedAt: Timestamp.fromMillis(nowMs),
    });
    return {status: 'joined', groupId};
  });
};

export interface RevokeResult {
  revoked: number;
}

/**
 * Cancels links of a group: every active link for the group's creator, the caller's own links for
 * any other member. A cancelled link shows "cancelled" to whoever opens it; people who already
 * joined stay.
 */
export const revokeInviteLinks = async (
  db: Firestore,
  caller: CallerIdentity,
  rawInput: unknown,
  deps: Deps = {},
): Promise<RevokeResult> => {
  const {groupId} = parseGroupInput(rawInput);
  requireVerified(caller);
  const nowMs = (deps.now ?? Date.now)();
  const groupSnap = await db.collection('groups').doc(groupId).get();
  if (!groupSnap.exists) {
    throw new InviteLinkError('not-found', 'Group not found.');
  }
  const group = groupSnap.data() as Fields;
  if (!isMember(group, caller)) {
    throw new InviteLinkError(
      'permission-denied',
      'Only a member of the group can cancel its invite links.',
    );
  }
  const isCreator = group.createdBy === caller.uid;
  const links = await db
    .collection('groupInvites')
    .where('groupId', '==', groupId)
    .get();
  const batch = db.batch();
  let revoked = 0;
  for (const doc of links.docs) {
    const data = doc.data();
    if (data.revoked === true) {
      continue;
    }
    if (!isCreator && data.createdByUid !== caller.uid) {
      continue;
    }
    batch.update(doc.ref, {
      revoked: true,
      revokedAt: Timestamp.fromMillis(nowMs),
      revokedByUid: caller.uid,
    });
    revoked += 1;
  }
  if (revoked > 0) {
    await batch.commit();
  }
  return {revoked};
};
