import {useContext, useEffect, useMemo, useRef} from 'react';
import {
  skipToken,
  useIsRestoring,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import {AuthContext} from '../../navigation/AuthProvider';
import {reportError} from '../services/ErrorReporter';
import {lookupUsersByEmail, type FoundUser} from '../services/UserLookup';
import type {GroupDocument, InvitationDocument, SplitDocument} from '../types';
import {useCached, type CachedData} from './hooks';
import {queryKeys} from './keys';
import {queryClient} from './queryClient';
import {retainListener, useRetainedListener} from './retainedListener';
import {sanitizeHistoryEntry, sanitizeSplit} from './sanitizeSplit';
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
): Record<string, FoundUser | null> | undefined => useMemberLookup(emails).data;

export interface MemberLookup {
  data: Record<string, FoundUser | null> | undefined;
  /** True when the lookup failed and there is no earlier answer. */
  error: boolean;
  retry: () => void;
}

/** Same as `useMemberDetails`, with the failure and a retry, for a screen that cannot go on without it. */
export const useMemberLookup = (emails: readonly string[]): MemberLookup => {
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
  return {
    data: result.data,
    error: result.data === undefined && result.isError,
    retry: () => {
      result.refetch();
    },
  };
};

// ---------------------------------------------------------------------------------------------
// The splits of a group

type WithId = {id: string};

const splitsListenerId = (groupId: string) => `splits:${groupId}`;

const millisOf = (value: unknown): number =>
  (value as {toMillis?: () => number} | undefined)?.toMillis?.() ?? 0;

/**
 * One listener on `groups/{id}/splits`, newest first by date (the creation time for older
 * splits). Each person inside a split is reduced to the fields the screens read before the copy
 * is cached (see sanitizeSplit.ts).
 */
const startGroupSplitsListener = (uid: string, groupId: string) => () => {
  const id = splitsListenerId(groupId);
  const {setStatus} = useSyncStore.getState();
  setStatus(id, 'loading');
  return onSnapshot(
    collection(getFirestore(), 'groups', groupId, 'splits'),
    snapshot => {
      const splits = snapshot.docs
        .map(d =>
          sanitizeSplit<Record<string, unknown>>({id: d.id, ...d.data()}),
        )
        .sort(
          (a, b) =>
            millisOf(b.date ?? b.createdAt) - millisOf(a.date ?? a.createdAt),
        );
      queryClient.setQueryData(queryKeys.groupSplits(uid, groupId), splits);
      setStatus(id, 'live');
    },
    error => {
      reportError(error);
      setStatus(id, 'error');
    },
  );
};

/**
 * The splits of one group, newest first. The listener is shared by every mounted screen that
 * shows this group (the group screen, its full transaction list, settle-up, a split's detail), so
 * a split added, edited or deleted, by anyone, shows up in all of them without a reload.
 */
export const useGroupSplits = <T extends WithId = SplitDocument>(
  groupId: string | undefined,
): CachedData<T[]> => {
  const {uid} = useIdentity();
  const id = uid && groupId ? splitsListenerId(groupId) : null;
  useRetainedListener(id, startGroupSplitsListener(uid, groupId ?? ''));
  const status = useSyncStore(state => statusOf(state.statuses, id ?? ''));
  return useCached<T[]>(queryKeys.groupSplits(uid, groupId ?? ''), status);
};

/**
 * One split of a group, taken from the cached splits. Once found it is kept for as long as the
 * screen lives, so deleting it does not flash "not found" while the screen closes. While the list
 * is only a saved copy, a split missing from it counts as loading.
 */
export const useGroupSplit = <T extends WithId = SplitDocument>(
  groupId: string | undefined,
  splitId: string | undefined,
): CachedData<T> => {
  const list = useGroupSplits<T>(groupId);
  const last = useRef<T | undefined>(undefined);
  const found = splitId ? list.data?.find(s => s.id === splitId) : undefined;
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

export interface GroupsSplits<T> {
  /** Splits by group id; undefined until every group has something to show. */
  data: Record<string, T[]> | undefined;
  loading: boolean;
  error: boolean;
  /** True once every group's listener has confirmed its splits. */
  live: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * The splits of several groups at once, for a screen that adds up across groups (friends and
 * balances). Each group uses the same shared listener as the screens of that group. `groupIds`
 * should be memoised by the caller.
 */
export const useGroupsSplits = <T extends WithId = SplitDocument>(
  groupIds: readonly string[],
): GroupsSplits<T> => {
  const {uid} = useIdentity();
  const restoring = useIsRestoring();
  const restartKey = useSyncStore(state => state.restartKey);
  const statuses = useSyncStore(state => state.statuses);
  const retry = useSyncStore(state => state.retry);
  const ids = useMemo(() => [...new Set(groupIds)].sort(), [groupIds]);
  const joined = ids.join('|');

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    const releases = ids.map(groupId =>
      retainListener(
        splitsListenerId(groupId),
        startGroupSplitsListener(uid, groupId),
      ),
    );
    return () => releases.forEach(release => release());
    // The ids are read through `joined` so a new array each render does not restart anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, joined, restartKey]);

  const results = useQueries({
    queries: ids.map(groupId => ({
      queryKey: queryKeys.groupSplits(uid, groupId),
      queryFn: skipToken,
    })),
  });
  const perGroup = ids.map((groupId, i) => ({
    id: groupId,
    data: results[i]?.data as T[] | undefined,
    status: statusOf(statuses, splitsListenerId(groupId)),
  }));
  const missing = perGroup.filter(p => p.data === undefined);
  return {
    data:
      missing.length === 0
        ? Object.fromEntries(perGroup.map(p => [p.id, p.data as T[]]))
        : undefined,
    loading:
      missing.length > 0 &&
      (restoring || missing.some(p => p.status === 'loading')),
    error:
      missing.length > 0 &&
      !restoring &&
      missing.some(p => p.status === 'error'),
    live: perGroup.every(p => p.status === 'live'),
    failed: perGroup.some(p => p.status === 'error'),
    retry,
  };
};

// ---------------------------------------------------------------------------------------------
// Split history

export interface SplitHistoryResult<T> {
  data: T[] | undefined;
  loading: boolean;
  error: boolean;
  /** Reads the history again; resolves when it is done. */
  refetch: () => Promise<unknown>;
}

const HISTORY_PER_GROUP = 50;

/**
 * The latest history entries of the given groups, newest first, in one list. An ordinary query,
 * not a listener: the saved copy shows at once and the history is read again when the screen
 * opens and on pull to refresh. `enabled` should be false until the list of groups is known, or
 * the query would run for an empty list.
 */
export const useSplitHistory = <T extends WithId = WithId>(
  groups: readonly {id: string; name?: string}[],
  enabled: boolean,
): SplitHistoryResult<T> => {
  const {uid} = useIdentity();
  const restoring = useIsRestoring();
  const joined = [...groups.map(g => g.id)].sort().join('|');
  const result = useQuery<T[]>({
    queryKey: queryKeys.splitHistory(uid, joined),
    enabled: enabled && uid !== '',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        const perGroup = await Promise.all(
          groups.map(g =>
            getDocs(
              query(
                collection(getFirestore(), 'groups', g.id, 'splitHistory'),
                orderBy('createdAt', 'desc'),
                limit(HISTORY_PER_GROUP),
              ),
            ).then(snapshot =>
              snapshot.docs.map(
                d =>
                  sanitizeHistoryEntry({
                    id: `${g.id}:${d.id}`,
                    groupId: g.id,
                    groupName: g.name,
                    ...d.data(),
                  }) as unknown as T,
              ),
            ),
          ),
        );
        return perGroup.flat().sort((a, b) => {
          const at = a as {
            createdAt?: {toMillis?: () => number; seconds?: number};
          };
          const bt = b as {
            createdAt?: {toMillis?: () => number; seconds?: number};
          };
          const ta =
            at.createdAt?.toMillis?.() ?? (at.createdAt?.seconds ?? 0) * 1000;
          const tb =
            bt.createdAt?.toMillis?.() ?? (bt.createdAt?.seconds ?? 0) * 1000;
          return tb - ta;
        });
      } catch (error) {
        reportError(error as Error);
        throw error;
      }
    },
  });
  const empty = result.data === undefined;
  return {
    data: result.data,
    loading: empty && (restoring || result.isPending) && enabled,
    error: empty && !restoring && result.isError,
    refetch: result.refetch,
  };
};

// ---------------------------------------------------------------------------------------------
// IOUs

const iouListenerId = (side: 'from' | 'to', uid: string) =>
  `iou${side === 'from' ? 'From' : 'To'}:${uid}`;

/** Pending IOUs where the person is the debtor (`from`) or the creditor (`to`). */
const startIouListener =
  (side: 'from' | 'to', uid: string, email: string) => () => {
    const id = iouListenerId(side, uid);
    const {setStatus} = useSyncStore.getState();
    setStatus(id, 'loading');
    return onSnapshot(
      query(
        collection(getFirestore(), 'ious'),
        where(side === 'from' ? 'fromEmail' : 'toEmail', '==', email),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
      ),
      snapshot => {
        queryClient.setQueryData(
          side === 'from' ? queryKeys.iouFrom(uid) : queryKeys.iouTo(uid),
          snapshot.docs.map(d => ({id: d.id, ...d.data()})),
        );
        setStatus(id, 'live');
      },
      error => {
        reportError(error);
        setStatus(id, 'error');
      },
    );
  };

export interface IousResult<T> {
  /** IOUs the person owes. */
  iOwe: T[] | undefined;
  /** IOUs owed to the person. */
  owedToMe: T[] | undefined;
  loading: boolean;
  error: boolean;
  live: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * The person's pending IOUs, in both directions, kept current by two shared listeners. Settling
 * one, or creating one on another screen, shows up without a reload.
 */
export const useIous = <T extends WithId = WithId>(): IousResult<T> => {
  const {uid, email} = useIdentity();
  const lower = email.toLowerCase();
  const fromId = uid && email ? iouListenerId('from', uid) : null;
  const toId = uid && email ? iouListenerId('to', uid) : null;
  useRetainedListener(fromId, startIouListener('from', uid, lower));
  useRetainedListener(toId, startIouListener('to', uid, lower));
  const fromStatus = useSyncStore(state =>
    statusOf(state.statuses, fromId ?? ''),
  );
  const toStatus = useSyncStore(state => statusOf(state.statuses, toId ?? ''));
  const from = useCached<T[]>(queryKeys.iouFrom(uid), fromStatus);
  const to = useCached<T[]>(queryKeys.iouTo(uid), toStatus);
  return {
    iOwe: from.data,
    owedToMe: to.data,
    loading: from.loading || to.loading,
    error: from.error || to.error,
    live: from.live && to.live,
    failed: from.failed || to.failed,
    retry: from.retry,
  };
};
