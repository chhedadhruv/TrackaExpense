import React, {useMemo} from 'react';
import {useLocalSearchParams} from 'expo-router';
import {EmptyState, ErrorState, LoadingState} from '../ScreenState';
import {
  useGroup,
  useGroupSplit,
  useGroupSplits,
  useMemberLookup,
} from '../../data/split';
import SplitDetailScreen, {
  type SplitDetailScreenProps,
} from '../../../screens/SplitScreens/SplitDetailScreen';
import SplitTransactionScreen from '../../../screens/SplitScreens/SplitTransactionScreen';
import CreateSplitScreen, {
  type CreateSplitScreenProps,
} from '../../../screens/SplitScreens/CreateSplitScreen';
import SettleUpScreen, {
  type SettleUpScreenProps,
} from '../../../screens/SplitScreens/SettleUpScreen';
import {
  calculateNetLendingBalances,
  type LendingSplit,
} from '../../utils/lending';
import {useCurrency} from '../../../utils/CurrencyUtil';
import {getAuth} from '@react-native-firebase/auth';

/** A group member as a person: the name falls back to the part of the email before the "@". */
interface ResolvedGroupMember {
  email: string;
  name: string;
  avatar: string | null;
  userId: string | null;
}

/** The part of a group document these routes need. */
interface LoadedGroup {
  id: string;
  name: string;
  members?: string[];
  memberNames?: Record<string, string>;
}

interface GroupRouteProps {
  groupId: string | undefined;
  render: (group: LoadedGroup) => React.ReactElement;
}

/**
 * The route-level wrapper for a screen of one group: the group comes from the cached list of the
 * person's groups (src/data/split.ts), so no screen reads the group document itself.
 */
const GroupRoute = ({groupId, render}: GroupRouteProps) => {
  const group = useGroup(groupId);
  if (group.data) {
    return render(group.data);
  }
  if (group.loading) {
    return <LoadingState message="Loading…" />;
  }
  if (group.error) {
    return <ErrorState onRetry={group.retry} />;
  }
  return (
    <EmptyState
      fill
      title="Group not found"
      message="It may have been deleted."
    />
  );
};

interface SplitRouteProps<T extends {id: string}> {
  groupId: string;
  splitId: string;
  /** Edit forms write from what they show, so they wait for the live copy. */
  needsLive?: boolean;
  render: (split: T) => React.ReactElement;
}

/** One split of a group, taken from the group's cached splits. */
const SplitRoute = <T extends {id: string}>({
  groupId,
  splitId,
  needsLive = false,
  render,
}: SplitRouteProps<T>) => {
  const split = useGroupSplit<T>(groupId, splitId);
  if (split.data && (!needsLive || split.live)) {
    return render(split.data);
  }
  if (split.error || (needsLive && split.failed)) {
    return <ErrorState onRetry={split.retry} />;
  }
  if (split.loading || split.data) {
    return <LoadingState message="Loading…" />;
  }
  return (
    <EmptyState
      fill
      title="Split not found"
      message="It may have been deleted."
    />
  );
};

/** A split, opened by the group id and the split id. */
export const SplitDetailRoute = () => {
  const {groupId, splitId} = useLocalSearchParams<{
    groupId: string;
    splitId: string;
  }>();
  return (
    <GroupRoute
      groupId={groupId}
      render={group => (
        <SplitRoute<SplitDetailScreenProps['split']>
          groupId={group.id}
          splitId={splitId ?? ''}
          render={split => <SplitDetailScreen group={group} split={split} />}
        />
      )}
    />
  );
};

/** The full list of a group's transactions. */
export const SplitTransactionsRoute = () => {
  const {groupId} = useLocalSearchParams<{groupId: string}>();
  return (
    <GroupRoute
      groupId={groupId}
      render={group => <SplitTransactionScreen group={group} />}
    />
  );
};

/** The add-a-split form, or the edit form when `splitId` is given. */
export const CreateSplitRoute = () => {
  const {groupId, splitId} = useLocalSearchParams<{
    groupId: string;
    splitId?: string;
  }>();
  return (
    <GroupRoute
      groupId={groupId}
      render={group =>
        splitId ? (
          <SplitRoute<NonNullable<CreateSplitScreenProps['split']>>
            groupId={group.id}
            splitId={splitId}
            needsLive
            render={split => <CreateSplitScreen group={group} split={split} />}
          />
        ) : (
          <CreateSplitScreen group={group} />
        )
      }
    />
  );
};

interface SettleUpWithMembersProps {
  group: LoadedGroup;
  preselect: SettleUpScreenProps['preselect'];
}

/**
 * Settle-up needs the members as people (name, avatar), not as emails, and the net balances for
 * its suggestions, so it looks the members up and works the balances out from the group's splits.
 * The suggestions are amounts the person will pay, so it waits for the live splits and shows an
 * error, not a guess, when either the splits or the member lookup fail.
 */
const SettleUpWithMembers = ({group, preselect}: SettleUpWithMembersProps) => {
  const {currency} = useCurrency();
  const emails = useMemo(() => group.members ?? [], [group.members]);
  const splits = useGroupSplits<LendingSplit & {id: string}>(group.id);
  const lookup = useMemberLookup(emails);

  const members = useMemo<ResolvedGroupMember[] | null>(() => {
    if (emails.length === 0) {
      return [];
    }
    if (!lookup.data) {
      return null;
    }
    return emails.map(email => {
      const match = lookup.data?.[email];
      const fallbackName = group.memberNames?.[email] || email.split('@')[0];
      return match
        ? {
            email,
            name: match.name || fallbackName,
            avatar: match.avatar,
            userId: match.uid,
          }
        : {email, name: fallbackName, avatar: null, userId: null};
    });
  }, [emails, lookup.data, group.memberNames]);

  const lendingDetails = useMemo(
    () =>
      splits.live && splits.data
        ? calculateNetLendingBalances(splits.data, currency.code)
        : null,
    [splits.live, splits.data, currency.code],
  );

  if (splits.failed || lookup.error) {
    return (
      <ErrorState
        onRetry={() => {
          splits.retry();
          lookup.retry();
        }}
      />
    );
  }
  if (members === null || lendingDetails === null) {
    return <LoadingState message="Loading…" />;
  }
  // Without a tapped pair, prefill what the signed-in person owes, as the group screen did.
  const myEmail = getAuth().currentUser?.email;
  const myDebt = lendingDetails.find(d => d.borrower.email === myEmail);
  return (
    <SettleUpScreen
      group={{id: group.id, name: group.name, members}}
      lendingDetails={lendingDetails}
      preselect={preselect ?? myDebt}
    />
  );
};

/**
 * Settle up. The screen that opens it decides what to prefill and passes only the two emails and
 * the amount; with none of them the form opens empty.
 */
export const SettleUpRoute = () => {
  const {groupId, lenderEmail, borrowerEmail, amount} = useLocalSearchParams<{
    groupId: string;
    lenderEmail?: string;
    borrowerEmail?: string;
    amount?: string;
  }>();
  const parsedAmount = amount === undefined ? NaN : Number(amount);
  const preselect =
    lenderEmail && borrowerEmail && Number.isFinite(parsedAmount)
      ? {
          lender: {email: lenderEmail},
          borrower: {email: borrowerEmail},
          amount: parsedAmount,
        }
      : undefined;
  return (
    <GroupRoute
      groupId={groupId}
      render={group => (
        <SettleUpWithMembers group={group} preselect={preselect} />
      )}
    />
  );
};
