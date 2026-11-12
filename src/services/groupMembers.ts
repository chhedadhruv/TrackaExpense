import {lookupUsersByEmail} from './UserLookup';

export interface ResolvedGroupMember {
  email: string;
  name: string;
  avatar: string | null;
  userId: string | null;
}

/**
 * Turns the member emails of a group into people with a display name, avatar and user id. Someone
 * without an account (a pending invitee) keeps the part of the email before the "@" as the name.
 * Throws if the lookup call fails.
 */
export const resolveGroupMembers = async (
  emails: string[],
): Promise<ResolvedGroupMember[]> => {
  const found = await lookupUsersByEmail(emails);
  return emails.map((email, i) => {
    const match = found[i];
    return match
      ? {
          email,
          name: match.name || email.split('@')[0],
          avatar: match.avatar,
          userId: match.uid,
        }
      : {email, name: email.split('@')[0], avatar: null, userId: null};
  });
};
