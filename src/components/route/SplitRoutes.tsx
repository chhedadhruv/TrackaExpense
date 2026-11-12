import React, {useCallback, useEffect, useState} from 'react';
import {useLocalSearchParams} from 'expo-router';
import DocumentRoute from './DocumentRoute';
import {ErrorState, LoadingState} from '../ScreenState';
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
  resolveGroupMembers,
  type ResolvedGroupMember,
} from '../../services/groupMembers';
import {reportError} from '../../services/ErrorReporter';
import {
  calculateNetLendingBalances,
  type LendingDetail,
  type LendingSplit,
} from '../../utils/lending';
import {useCurrency} from '../../../utils/CurrencyUtil';
import {getAuth} from '@react-native-firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
} from '@react-native-firebase/firestore';

/** The part of a group document these routes need. */
interface LoadedGroup {
  id: string;
  name: string;
  members?: string[];
}

const groupSegments = (groupId: string | undefined) =>
  groupId ? ['groups', groupId] : null;

/** A split, opened by the group id and the split id. */
export const SplitDetailRoute = () => {
  const {groupId, splitId} = useLocalSearchParams<{
    groupId: string;
    splitId: string;
  }>();
  return (
    <DocumentRoute<LoadedGroup>
      segments={groupSegments(groupId)}
      missingTitle="Group not found"
      render={group => (
        <DocumentRoute<SplitDetailScreenProps['split']>
          segments={
            groupId && splitId ? ['groups', groupId, 'splits', splitId] : null
          }
          missingTitle="Split not found"
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
    <DocumentRoute<LoadedGroup>
      segments={groupSegments(groupId)}
      missingTitle="Group not found"
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
    <DocumentRoute<LoadedGroup>
      segments={groupSegments(groupId)}
      missingTitle="Group not found"
      render={group =>
        splitId ? (
          <DocumentRoute<NonNullable<CreateSplitScreenProps['split']>>
            segments={['groups', group.id, 'splits', splitId]}
            missingTitle="Split not found"
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

interface SettleUpData {
  members: ResolvedGroupMember[];
  lendingDetails: LendingDetail[];
}

/**
 * Settle-up needs the members as people (name, avatar), not as emails, and the net balances for
 * its suggestions, so it looks the members up and works the balances out from the group's splits.
 */
const SettleUpWithMembers = ({group, preselect}: SettleUpWithMembersProps) => {
  const {currency} = useCurrency();
  const [data, setData] = useState<SettleUpData | null>(null);
  const [failed, setFailed] = useState(false);
  const emailsKey = (group.members ?? []).join(',');

  const load = useCallback(() => {
    let active = true;
    setFailed(false);
    Promise.all([
      resolveGroupMembers(group.members ?? []),
      getDocs(collection(getFirestore(), 'groups', group.id, 'splits')),
    ])
      .then(([members, splitsSnapshot]) => {
        if (!active) {
          return;
        }
        const splits = splitsSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as LendingSplit[];
        setData({
          members,
          lendingDetails: calculateNetLendingBalances(splits, currency.code),
        });
      })
      .catch(error => {
        reportError(error as Error);
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
    // The members are read through `emailsKey` so a new array each render does not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailsKey, group.id, currency.code]);

  useEffect(() => load(), [load]);

  if (failed) {
    return <ErrorState onRetry={load} />;
  }
  if (data === null) {
    return <LoadingState message="Loading…" />;
  }
  // Without a tapped pair, prefill what the signed-in person owes, as the group screen did.
  const myEmail = getAuth().currentUser?.email;
  const myDebt = data.lendingDetails.find(d => d.borrower.email === myEmail);
  return (
    <SettleUpScreen
      group={{id: group.id, name: group.name, members: data.members}}
      lendingDetails={data.lendingDetails}
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
    <DocumentRoute<LoadedGroup>
      segments={groupSegments(groupId)}
      missingTitle="Group not found"
      render={group => (
        <SettleUpWithMembers group={group} preselect={preselect} />
      )}
    />
  );
};
