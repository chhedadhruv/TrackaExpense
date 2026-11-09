import {getApp} from '@react-native-firebase/app';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';

/**
 * Accepting or declining a group invitation is done by the server
 * (functions/src/invitation.ts): it checks the invitation is addressed to the signed-in user,
 * then updates the group and the invitation together. Screens must not write those documents
 * themselves.
 */

export interface RespondToInvitationResult {
  status: 'accepted' | 'declined';
  /** True when the invitation had already been answered the same way. */
  alreadyDone: boolean;
}

export const respondToInvitation = async (
  invitationId: string,
  accept: boolean,
): Promise<RespondToInvitationResult> => {
  const call = httpsCallable<
    {invitationId: string; accept: boolean},
    RespondToInvitationResult
  >(getFunctions(getApp(), 'asia-south1'), 'respondToInvitation');
  return (await call({invitationId, accept})).data;
};
