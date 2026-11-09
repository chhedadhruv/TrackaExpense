import {FieldValue, Timestamp, type Firestore} from 'firebase-admin/firestore';
import type {Fields} from './derive';

/**
 * Accepting or declining a group invitation. Before this, the invited person's app changed the
 * group (a group they were not yet in) and the invitation (a document they did not create)
 * directly, which only works while the rules let any signed-in user write both. Now one server
 * step does it, after checking the invitation really is addressed to the caller.
 *
 * The caller is identified by the email in their verified sign-in token, never by the `email`
 * field of their profile document: that field can be edited by its owner, so it could be set to
 * someone else's address to take over their invitations.
 */

export class InvitationError extends Error {
  constructor(
    readonly code:
      | 'invalid-argument'
      | 'not-found'
      | 'permission-denied'
      | 'failed-precondition',
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

export interface RespondInput {
  invitationId: string;
  accept: boolean;
}

export interface RespondResult {
  status: 'accepted' | 'declined';
  alreadyDone: boolean;
}

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const sameEmail = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

export const parseRespondInput = (input: unknown): RespondInput => {
  if (
    !isRecord(input) ||
    typeof input.invitationId !== 'string' ||
    input.invitationId === '' ||
    input.invitationId.includes('/') ||
    typeof input.accept !== 'boolean'
  ) {
    throw new InvitationError(
      'invalid-argument',
      'invitationId and accept are required',
    );
  }
  return {invitationId: input.invitationId, accept: input.accept};
};

export const respondToInvitation = async (
  db: Firestore,
  caller: CallerIdentity,
  rawInput: unknown,
): Promise<RespondResult> => {
  const {invitationId, accept} = parseRespondInput(rawInput);
  if (!caller.email || !caller.emailVerified) {
    throw new InvitationError(
      'permission-denied',
      'A verified email address is needed to answer an invitation.',
    );
  }
  const callerEmail = caller.email;
  const wanted = accept ? 'accepted' : 'declined';
  const invitationRef = db.collection('invitations').doc(invitationId);
  const userRef = db.collection('users').doc(caller.uid);

  return db.runTransaction(async tx => {
    const invitationSnap = await tx.get(invitationRef);
    if (!invitationSnap.exists) {
      throw new InvitationError('not-found', 'Invitation not found.');
    }
    const invitation = invitationSnap.data() as Fields;
    if (!sameEmail(invitation.email, callerEmail)) {
      throw new InvitationError(
        'permission-denied',
        'This invitation is not addressed to you.',
      );
    }
    if (invitation.status === wanted) {
      return {status: wanted, alreadyDone: true};
    }
    if (invitation.status !== 'pending') {
      throw new InvitationError(
        'failed-precondition',
        'This invitation has already been answered.',
      );
    }
    const groupId = text(invitation.groupId);
    if (!groupId) {
      throw new InvitationError(
        'failed-precondition',
        'The invitation has no group.',
      );
    }
    const groupRef = db.collection('groups').doc(groupId);
    const [groupSnap, userSnap] = await Promise.all([
      tx.get(groupRef),
      tx.get(userRef),
    ]);
    const respondedAt = Timestamp.now();

    if (!groupSnap.exists) {
      if (accept) {
        throw new InvitationError(
          'failed-precondition',
          'This group no longer exists.',
        );
      }
      tx.update(invitationRef, {status: wanted, respondedAt});
      return {status: wanted, alreadyDone: false};
    }
    const group = groupSnap.data() as Fields;
    // Both spellings of the address may be in the list (invited as typed, joined as signed in).
    const pending = (
      Array.isArray(group.pendingInvites) ? group.pendingInvites : []
    ).filter(email => !sameEmail(email, callerEmail));

    if (!accept) {
      tx.update(groupRef, {
        pendingInvites: pending,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(invitationRef, {status: wanted, respondedAt});
      return {status: wanted, alreadyDone: false};
    }

    const members: unknown[] = Array.isArray(group.members)
      ? [...group.members]
      : [];
    if (!members.some(member => sameEmail(member, callerEmail))) {
      members.push(callerEmail);
    }
    const profile = (userSnap.data() ?? {}) as Fields;
    const name =
      text(profile.name) ??
      text(profile.displayName) ??
      text(caller.name) ??
      callerEmail;
    const memberNames = {
      ...(isRecord(group.memberNames) ? group.memberNames : {}),
      [callerEmail]: name,
    };
    tx.update(groupRef, {
      members,
      memberNames,
      pendingInvites: pending,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(invitationRef, {status: wanted, respondedAt});
    return {status: wanted, alreadyDone: false};
  });
};
