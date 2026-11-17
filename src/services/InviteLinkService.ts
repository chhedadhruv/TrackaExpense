import {getApp} from '@react-native-firebase/app';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';

/**
 * Group invite links are made, checked and used by the server (functions/src/inviteLinks.ts). The
 * app never reads or writes the link documents: it only calls these four functions.
 */

export interface CreatedInviteLink {
  token: string;
  groupId: string;
  expiresAtMs: number;
}

export interface InviteLinkPreview {
  groupId: string;
  groupName: string;
  memberCount: number;
  alreadyMember: boolean;
  expiresAtMs: number;
}

export interface JoinResult {
  status: 'joined' | 'already-member';
  groupId: string;
}

const callable = <Request, Response>(name: string) =>
  httpsCallable<Request, Response>(getFunctions(getApp(), 'asia-south1'), name);

/** A new link (valid for 7 days) for a group the signed-in person belongs to. */
export const createGroupInviteLink = async (
  groupId: string,
): Promise<CreatedInviteLink> =>
  (
    await callable<{groupId: string}, CreatedInviteLink>(
      'createGroupInviteLink',
    )({groupId})
  ).data;

/** The group name and size behind a link; throws when the link is wrong, cancelled or expired. */
export const previewGroupInviteLink = async (
  groupId: string,
  token: string,
): Promise<InviteLinkPreview> =>
  (
    await callable<{groupId: string; token: string}, InviteLinkPreview>(
      'previewGroupInviteLink',
    )({groupId, token})
  ).data;

/** Joins the signed-in person to the group; harmless when they are already in it. */
export const joinGroupByLink = async (
  groupId: string,
  token: string,
): Promise<JoinResult> =>
  (
    await callable<{groupId: string; token: string}, JoinResult>(
      'joinGroupByLink',
    )({groupId, token})
  ).data;

/** Cancels the person's own links of the group (every link of the group for its creator). */
export const revokeGroupInviteLinks = async (
  groupId: string,
): Promise<{revoked: number}> =>
  (
    await callable<{groupId: string}, {revoked: number}>(
      'revokeGroupInviteLinks',
    )({groupId})
  ).data;
