import {useContext, useMemo, useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import {AuthContext} from '../../navigation/AuthProvider';
import {reportError} from '../services/ErrorReporter';
import {lookupUsersByEmail, type FoundUser} from '../services/UserLookup';
import type {GroupDocument, InvitationDocument} from '../types';
import {useCached, type CachedData} from './hooks';
import {queryKeys} from './keys';
import {queryClient} from './queryClient';
import {useRetainedListener} from './retainedListener';
import {statusOf, useSyncStore} from './syncStore';

/**
 * Cached data for the Split area. Unlike the profile and the transactions, which DataSync keeps
 * current for the whole session, these listeners run only while a screen that needs them is
 * mounted (and are shared between such screens, see retainedListener.ts). A Split tab stays
 * mounted once opened, so in practice they start once per session.
 *
 * Groups and invitations are found by the signed-in person's email, as the screens always did.
 */

const useIdentity = (): {uid: string; email: string} => {
  const user = useContext(AuthContext).user;
  return {uid: user?.uid ?? '', email: user?.email ?? ''};
};

const groupsListenerId = (uid: string) => `groups:${uid}`;
const invitationsListenerId = (uid: string) => `invitations:${uid}`;

const startGroupsListener = (uid: string, email: string) => () => {
  const id = groupsListenerId(uid);
  const {setStatus} = useSyncStore.getState();
  setStatus(id, 'loading');
  return onSnapshot(
    query(
      collection(getFirestore(), 'groups'),
      where('members', 'array-contains', email),
    ),
    snapshot => {
      queryClient.setQueryData(
        queryKeys.groups(uid),
        snapshot.docs.map(d => ({id: d.id, ...d.data()})) as GroupDocument[],
      );
      setStatus(id, 'live');
    },
    error => {
      reportError(error);
      setStatus(id, 'error');
    },
  );
};

const startInvitationsListener = (uid: string, email: string) => () => {
  const id = invitationsListenerId(uid);
  const {setStatus} = useSyncStore.getState();
  setStatus(id, 'loading');
  return onSnapshot(
    query(
      collection(getFirestore(), 'invitations'),
      where('email', '==', email),
      where('status', '==', 'pending'),
    ),
    snapshot => {
      queryClient.setQueryData(
        queryKeys.invitations(uid),
        snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as InvitationDocument[],
      );
      setStatus(id, 'live');
    },
    error => {
      reportError(error);
      setStatus(id, 'error');
    },
  );
};

/** The groups the signed-in person belongs to. */
export const useGroups = (): CachedData<GroupDocument[]> => {
  const {uid, email} = useIdentity();
  const id = uid && email ? groupsListenerId(uid) : null;
  useRetainedListener(id, startGroupsListener(uid, email));
  const status = useSyncStore(state => statusOf(state.statuses, id ?? ''));
  return useCached<GroupDocument[]>(queryKeys.groups(uid), status);
};

/**
 * One group by id, taken from the cached list of groups. Once found it is kept for as long as the
 * screen lives, so deleting the group does not flash "not found" while the screen closes. While
 * the list is only a saved copy (not yet confirmed) a group missing from it counts as loading,
 * because it may be a group the person has just joined.
 */
export const useGroup = (
  groupId: string | undefined,
): CachedData<GroupDocument> => {
  const list = useGroups();
  const last = useRef<GroupDocument | undefined>(undefined);
  const found = groupId ? list.data?.find(g => g.id === groupId) : undefined;
  if (found) {
    last.current = found;
  }
  const data = found ?? last.current;
  return {
    data,
    loading: !data && (list.loading || (!list.live && !list.failed)),
    error: !data && list.failed,
    live: list.live,
    failed: list.failed,
    retry: list.retry,
  };
};

/** The pending invitations addressed to the signed-in person. */
export const useInvitations = (): CachedData<InvitationDocument[]> => {
  const {uid, email} = useIdentity();
  const id = uid && email ? invitationsListenerId(uid) : null;
  useRetainedListener(id, startInvitationsListener(uid, email));
  const status = useSyncStore(state => statusOf(state.statuses, id ?? ''));
  return useCached<InvitationDocument[]>(queryKeys.invitations(uid), status);
};

const FIVE_MINUTES = 1000 * 60 * 5;

/**
 * Name, avatar and user id for a set of emails, from the `lookupUsersByContact` callable. One call
 * serves every member of every group on screen, and the answer is kept for a few minutes instead
 * of being asked again each time a screen is shown. It is not saved to disk. `undefined` until it
 * arrives; an email with no account maps to null.
 */
export const useMemberDetails = (
  emails: readonly string[],
): Record<string, FoundUser | null> | undefined => {
  const unique = useMemo(() => [...new Set(emails)].sort(), [emails]);
  const joined = unique.join('|');
  const result = useQuery<Record<string, FoundUser | null>>({
    queryKey: queryKeys.memberDetails(joined),
    enabled: unique.length > 0,
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      try {
        const found = await lookupUsersByEmail(unique);
        return Object.fromEntries(unique.map((e, i) => [e, found[i] ?? null]));
      } catch (error) {
        reportError(error as Error);
        throw error;
      }
    },
  });
  return result.data;
};
