import React, {useContext, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import {useAsyncActionByKey} from '../../src/hooks/useAsyncAction';
import Card from '../../src/components/Card';
import {useLocalSearchParams, useRouter} from 'expo-router';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Bell from 'lucide-react-native/icons/bell';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import Link2 from 'lucide-react-native/icons/link-2';
import LogOut from 'lucide-react-native/icons/log-out';
import MailCheck from 'lucide-react-native/icons/mail-check';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Receipt from 'lucide-react-native/icons/receipt';
import Repeat from 'lucide-react-native/icons/repeat';
import Trash2 from 'lucide-react-native/icons/trash-2';
import UserAvatar from '../../src/components/Avatar';
import {
  Timestamp,
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  deleteField,
  doc as fsDoc,
  getDoc,
  getDocs,
  getFirestore,
  query as fsQuery,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import {
  calculateNetLendingBalances,
  type LendingDetail,
} from '../../src/utils/lending';
import moment from 'moment';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import {AuthContext} from '../../navigation/AuthProvider';
import SplitNotificationService from '../../services/SplitNotificationService';
import {useCurrency} from '../../utils/CurrencyUtil';
import {majorOf} from '../../src/utils/amounts';
import {toMajorNumber} from '../../src/utils/money';
import {shareOfMinor, totalSpentMajor} from '../../src/utils/splitMath';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {ErrorState, LoadingState} from '../../src/components/ScreenState';
import {useGroup, useGroupSplits, useMemberDetails} from '../../src/data/split';
import {suppressNextLock} from '../../src/lock/suppress';
import {snackbar} from '../../src/utils/snackbarStore';
import {reportError} from '../../src/services/ErrorReporter';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import {
  createGroupInviteLink,
  revokeGroupInviteLinks,
} from '../../src/services/InviteLinkService';
import {
  buildInviteUrl,
  inviteLinkErrorMessage,
  inviteMessage,
} from '../../src/utils/inviteLinks';

interface GroupMember {
  email: string;
  name: string;
  avatar?: string | null;
  userId?: string | null;
}

interface SplitUser {
  email?: string;
  name?: string;
  percentage?: number;
}

interface SplitItem {
  id: string;
  title?: string;
  amount: number | string;
  type?: string;
  isSettlement?: boolean;
  splitType?: string;
  category?: string;
  paidBy?: {email?: string; name?: string};
  splitUsers?: SplitUser[];
  date?: {toDate: () => Date; toMillis?: () => number};
  createdAt?: {toDate: () => Date; toMillis?: () => number};
  recurring?: {enabled?: boolean; frequency?: string};
}

interface Group {
  id: string;
  name: string;
  members?: GroupMember[];
}

const RECENT_SPLITS_LIMIT = 3;

// Stable empty lists, so memos downstream do not recompute while nothing has loaded.
const NO_SPLITS: SplitItem[] = [];
const NO_EMAILS: string[] = [];

// The deeper brand shade of the delete button on the group card, which is brand-coloured in
// both themes.
const GROUP_CARD_DELETE_FILL = '#2E3E8B';

const getSplitCardColor = (
  split: SplitItem,
  currentEmail: string | undefined,
  colors: ThemeColors,
): string => {
  if (!currentEmail) {
    return colors.primary;
  }
  if (split.type === 'settlement' || split.isSettlement) {
    const payerEmail = split.paidBy?.email?.toLowerCase();
    const isReceiver =
      split.splitUsers?.some(u => u.email?.toLowerCase() === currentEmail) &&
      payerEmail !== currentEmail;
    if (isReceiver) {
      return colors.incomeText;
    }
    if (payerEmail === currentEmail) {
      return colors.expenseText;
    }
    return colors.primary;
  }
  const isPayer = split.paidBy?.email?.toLowerCase() === currentEmail;
  const isInSplitUsers = split.splitUsers?.some(
    u => u.email?.toLowerCase() === currentEmail,
  );
  const payerOwedByOthers =
    isPayer &&
    (split.splitUsers?.some(u => u.email?.toLowerCase() !== currentEmail) ??
      false);
  if (payerOwedByOthers) {
    return colors.incomeText;
  }
  if (!isPayer && isInSplitUsers) {
    return colors.expenseText;
  }
  return colors.primary;
};

const SplitGroupDetailScreen = () => {
  const {currency, formatAmount} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{groupId?: string; groupName?: string}>();
  // Everything on this screen comes from the shared cache, kept current by live listeners
  // (src/data/split.ts): the group, its splits, and the members' names. A split added, edited or
  // deleted here or by anyone else shows up with no reload, so nothing is fetched on focus.
  const groupData = useGroup(params.groupId);
  const splitsData = useGroupSplits<SplitItem>(params.groupId);
  // The name in the link (from the list or a push) shows at once; the group's own name replaces
  // it as soon as the group is known.
  const groupName = groupData.data?.name ?? (params.groupName || 'Split Group');
  const group: Group | null = useMemo(
    () => (params.groupId ? {id: params.groupId, name: groupName} : null),
    [params.groupId, groupName],
  );
  const {user} = useContext(AuthContext);
  const splits = splitsData.data ?? NO_SPLITS;
  const filteredSplits = splits;
  const totalSplitAmount = useMemo(
    () => totalSpentMajor(splits, currency.code),
    [splits, currency.code],
  );
  const detailedLendingInfo: LendingDetail[] = useMemo(
    () => calculateNetLendingBalances(splits, currency.code),
    [splits, currency.code],
  );
  const pendingInvites = groupData.data?.pendingInvites ?? NO_EMAILS;
  const memberEmails = groupData.data?.members ?? NO_EMAILS;
  const foundMembers = useMemberDetails(memberEmails);
  const groupMembers: GroupMember[] = useMemo(
    () =>
      memberEmails.map(email => {
        const match = foundMembers?.[email];
        const name =
          match?.name ||
          groupData.data?.memberNames?.[email] ||
          email.split('@')[0];
        return match
          ? {email, name, avatar: match.avatar, userId: match.uid}
          : {email, name, avatar: null, userId: null};
      }),
    [memberEmails, foundMembers, groupData.data?.memberNames],
  );
  const loading = splitsData.loading;
  // A failed load must not read as "No splits yet" with no settlement suggestions.
  const failed = splitsData.error;
  // Leave, delete and resend share one lock, so only one of them runs at a time. `busyKey` names
  // the one that is running: 'leave', 'delete' or 'resend:<email>'.
  const {run: runGroupAction, pendingKey: busyKey} = useAsyncActionByKey(
    (_key: string, task: () => Promise<void>) => task(),
  );

  if (!group || !group.id) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Group not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Makes a link for this group and opens the share sheet with it. Any member can; the link works
  // for 7 days (functions/src/inviteLinks.ts).
  const shareInviteLink = async () => {
    try {
      const created = await createGroupInviteLink(group!.id);
      suppressNextLock();
      await Share.share({
        message: inviteMessage(
          group!.name,
          buildInviteUrl(created.groupId, created.token),
        ),
      });
    } catch (error) {
      reportError(error as Error);
      snackbar.error(inviteLinkErrorMessage(error));
    }
  };

  // Cancels the person's own links of this group (all of them for the group's creator).
  const cancelInviteLinks = async () => {
    try {
      const {revoked} = await revokeGroupInviteLinks(group!.id);
      snackbar.success(
        revoked === 0
          ? 'You have no active invite links for this group'
          : 'Invite links cancelled',
      );
    } catch (error) {
      reportError(error as Error);
      snackbar.error(inviteLinkErrorMessage(error));
    }
  };

  const handleSettleUp = (
    lender?: LendingDetail['lender'],
    borrower?: LendingDetail['borrower'],
    amount?: number,
  ) => {
    // The amounts offered here come from the splits on screen; a saved copy could be older than
    // what someone else added, so wait for the live listener to confirm them.
    if (!splitsData.live) {
      snackbar.info('Still syncing this group. Try again in a moment.');
      return;
    }
    // The pair that was tapped is prefilled; without one the settle-up screen prefills what the
    // signed-in person owes.
    router.navigate({
      pathname: '/split/group/[groupId]/settle',
      params: {
        groupId: group!.id,
        ...(lender && borrower && amount !== undefined
          ? {
              lenderEmail: lender.email,
              borrowerEmail: borrower.email,
              amount: String(amount),
            }
          : {}),
      },
    });
  };

  const handleResendInvite = async (email: string) => {
    try {
      const actorName =
        user?.displayName || user?.email?.split('@')[0] || 'Someone';
      // Update existing declined invitation back to pending, or create a new one
      const existing = await getDocs(
        fsQuery(
          collection(getFirestore(), 'invitations'),
          where('groupId', '==', group!.id),
          where('email', '==', email),
        ),
      );
      if (!existing.empty) {
        await updateDoc(existing.docs[0].ref, {
          status: 'pending',
          createdAt: Timestamp.fromDate(new Date()),
        });
      } else {
        await addDoc(collection(getFirestore(), 'invitations'), {
          email,
          groupId: group!.id,
          groupName: group!.name,
          inviterUid: user?.uid,
          inviterEmail: user?.email,
          inviterName: actorName,
          status: 'pending',
          createdAt: Timestamp.fromDate(new Date()),
        });
      }
      await SplitNotificationService.notifySplitInvite(
        {
          id: group!.id,
          name: group!.name,
          members: groupMembers.map(m => m.email),
        } as any,
        actorName,
        email,
      );
      AnalyticsService.logInviteMember({invite_count: 1, source: 'resend'});
      snackbar.success(`Invitation resent to ${email}`);
    } catch (_) {
      snackbar.error('Failed to resend invitation');
    }
  };

  const leaveGroup = async () => {
    try {
      const userEmail = (user?.email || '').toLowerCase();
      if (!userEmail) {
        snackbar.error('User not found');
        return;
      }
      await updateDoc(fsDoc(getFirestore(), 'groups', group!.id), {
        members: arrayRemove(userEmail),
        [`memberNames.${userEmail}`]: deleteField(),
      });
      snackbar.info('You have left the group.');
      router.back();
    } catch (_) {
      snackbar.error('Failed to leave group');
    }
  };

  const deleteGroup = async () => {
    try {
      const splitsRef = collection(
        getFirestore(),
        'groups',
        group!.id,
        'splits',
      );
      const snapshot = await getDocs(splitsRef);
      const batch = writeBatch(getFirestore());
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      await deleteDoc(fsDoc(getFirestore(), 'groups', group!.id));
      snackbar.success('Group deleted successfully');
      router.back();
    } catch (_) {
      snackbar.error('Failed to delete group');
    }
  };

  const renderGroupSummaryCard = () => (
    <Card
      style={[
        styles.groupSummaryCard,
        Platform.OS === 'android' && styles.cardAndroid,
      ]}
      elevation={Platform.OS === 'android' ? 0 : 2}>
      <View style={styles.cardContent}>
        <Text style={styles.titleText}>{group!.name}</Text>
        <View style={styles.groupMemberAvatars}>
          {groupMembers.slice(0, 4).map(member => (
            <View key={member.email} style={styles.memberWrapper}>
              <UserAvatar
                size={40}
                name={member.name}
                src={member.avatar ?? undefined}
                style={styles.groupMemberAvatar}
              />
              <Text
                style={styles.memberName}
                numberOfLines={1}
                ellipsizeMode="tail">
                {member.name}
              </Text>
            </View>
          ))}
          {groupMembers.length > 4 && (
            <View style={[styles.memberWrapper, styles.extraMembersAvatar]}>
              <Text style={styles.extraMembersText}>
                +{groupMembers.length - 4}
              </Text>
            </View>
          )}
        </View>
        {pendingInvites.length > 0 && (
          <View style={styles.pendingInvitesContainer}>
            <Text style={styles.pendingInvitesLabel}>Pending Invites</Text>
            {pendingInvites.map(email => (
              <View key={email} style={styles.pendingInviteRow}>
                <Clock size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.pendingInviteEmail} numberOfLines={1}>
                  {email}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    runGroupAction(`resend:${email}`, () =>
                      handleResendInvite(email),
                    )
                  }
                  disabled={busyKey !== null}
                  accessibilityState={{
                    disabled: busyKey !== null,
                    busy: busyKey === `resend:${email}`,
                  }}
                  style={styles.resendButton}>
                  {busyKey === `resend:${email}` ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <MailCheck size={16} color={colors.onPrimary} />
                      <Text style={styles.resendText}>Resend</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.iconButton, styles.editButton]}
            onPress={() => {
              Alert.alert(
                'Invite with a link',
                'Anyone with the link can join this group for 7 days, after confirming.',
                [
                  {
                    text: 'Share a new link',
                    onPress: () => runGroupAction('invite', shareInviteLink),
                  },
                  {
                    text: 'Cancel my links',
                    style: 'destructive',
                    onPress: () => runGroupAction('revoke', cancelInviteLinks),
                  },
                  {text: 'Close', style: 'cancel'},
                ],
              );
            }}
            disabled={busyKey !== null}
            accessibilityState={{
              disabled: busyKey !== null,
              busy: busyKey === 'invite' || busyKey === 'revoke',
            }}
            accessibilityLabel="Invite with a link"
            accessibilityRole="button">
            {busyKey === 'invite' || busyKey === 'revoke' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Link2 size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.editButton]}
            onPress={() =>
              router.navigate({
                pathname: '/split',
                params: {editGroupId: group!.id},
              })
            }
            accessibilityLabel="Edit group"
            accessibilityRole="button">
            <Pencil size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.leaveButton]}
            onPress={() => {
              Alert.alert(
                'Leave Group',
                'Are you sure you want to leave this group? You will be removed from future splits.',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: () => runGroupAction('leave', leaveGroup),
                  },
                ],
              );
            }}
            disabled={busyKey !== null}
            accessibilityState={{
              disabled: busyKey !== null,
              busy: busyKey === 'leave',
            }}
            accessibilityLabel="Leave group"
            accessibilityRole="button">
            {busyKey === 'leave' ? (
              <ActivityIndicator size="small" color={colors.expense} />
            ) : (
              <LogOut size={24} color={colors.expense} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.deleteButton]}
            onPress={() => {
              Alert.alert(
                'Delete Group',
                'Are you sure you want to delete this group and its splits? This cannot be undone.',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => runGroupAction('delete', deleteGroup),
                  },
                ],
              );
            }}
            disabled={busyKey !== null}
            accessibilityState={{
              disabled: busyKey !== null,
              busy: busyKey === 'delete',
            }}
            accessibilityLabel="Delete group"
            accessibilityRole="button">
            {busyKey === 'delete' ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Trash2 size={24} color={colors.onPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const renderStatsSummary = () => {
    const currentEmail = user?.email?.toLowerCase();
    // Summed as integer minor units; a split that is not shared with you, or whose amount cannot
    // be converted, adds nothing.
    const myShareMinor = splits.reduce((total, split) => {
      if (split.type === 'settlement' || split.isSettlement) {
        return total;
      }
      return total + (shareOfMinor(split, currentEmail, currency.code) ?? 0);
    }, 0);
    const myShare = toMajorNumber(myShareMinor, currency.code);
    return (
      <View style={styles.statsRow}>
        <Card
          style={[
            styles.statCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 1}>
          <View style={styles.statCardContent}>
            <View
              style={[
                styles.statIconCircle,
                {backgroundColor: colors.primarySoft},
              ]}>
              <Receipt size={18} color={colors.primary} />
            </View>
            <Text style={styles.statCardLabel}>Total Spent</Text>
            <Text style={[styles.statCardValue, {color: colors.primary}]}>
              {formatAmount(totalSplitAmount)}
            </Text>
          </View>
        </Card>
        <Card
          style={[
            styles.statCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 1}>
          <View style={styles.statCardContent}>
            <View
              style={[
                styles.statIconCircle,
                {backgroundColor: colors.expenseSoft},
              ]}>
              <HandCoins size={18} color={colors.expense} />
            </View>
            <Text style={styles.statCardLabel}>Your Share</Text>
            <Text style={[styles.statCardValue, {color: colors.expenseText}]}>
              {formatAmount(myShare)}
            </Text>
          </View>
        </Card>
      </View>
    );
  };

  const renderDetailedLendingSummary = () => {
    const visibleDetails = detailedLendingInfo.filter(d => d.amount > 0.009);
    if (visibleDetails.length === 0) {
      return null;
    }
    const currentEmail = user?.email?.toLowerCase();
    const hasActionable = visibleDetails.some(
      d =>
        currentEmail &&
        (currentEmail === d.borrower.email?.toLowerCase() ||
          currentEmail === d.lender.email?.toLowerCase()),
    );
    return (
      <View style={styles.lendingSummaryContainer}>
        <Text style={styles.sectionHeaderText}>Settlement Suggestions</Text>
        {visibleDetails.map((detail, index) => {
          const payerEmail = detail.borrower.email?.toLowerCase();
          const receiverEmail = detail.lender.email?.toLowerCase();
          const viewerPays = currentEmail && currentEmail === payerEmail;
          const viewerReceives = currentEmail && currentEmail === receiverEmail;
          const amountStr = formatAmount(detail.amount);
          return (
            <Card
              key={index}
              style={[
                styles.lendingSummaryCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 1}>
              <View style={styles.lendingSummaryContent}>
                <View style={styles.lendingUserContainer}>
                  <UserAvatar size={40} name={detail.borrower.name} />
                  <View style={styles.arrowIcon}>
                    <ArrowRight size={20} color={colors.textMuted} />
                  </View>
                  <UserAvatar size={40} name={detail.lender.name} />
                </View>
                {viewerPays ? (
                  <Text style={styles.lendingDetailText}>
                    You pay {detail.lender.name}{' '}
                    <Text
                      style={[
                        styles.amountStrongText,
                        {color: colors.expenseText},
                      ]}>
                      {amountStr}
                    </Text>
                  </Text>
                ) : viewerReceives ? (
                  <>
                    <Text style={styles.lendingDetailText}>
                      You receive{' '}
                      <Text
                        style={[
                          styles.amountStrongText,
                          {color: colors.incomeText},
                        ]}>
                        {amountStr}
                      </Text>{' '}
                      from {detail.borrower.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.remindIconButton}
                      onPress={async () => {
                        try {
                          // Own profile: still a direct read of the signed-in user's own document.
                          const lenderDoc = await getDoc(
                            fsDoc(getFirestore(), 'users', user!.uid),
                          );
                          const lenderName =
                            lenderDoc.data()?.name ||
                            user?.email?.split('@')[0] ||
                            'Someone';
                          const result =
                            await SplitNotificationService.notifyPaymentReminder(
                              group as any,
                              detail.borrower as any,
                              {name: lenderName, email: user?.email} as any,
                              detail.amount,
                            );
                          if (result?.reason === 'cooldown') {
                            snackbar.error(
                              'You already sent a reminder in the last 24 hours.',
                            );
                          } else if (result?.success) {
                            snackbar.success(
                              `${detail.borrower.name} has been reminded to pay you.`,
                            );
                          }
                        } catch (_) {
                          snackbar.error('Failed to send reminder');
                        }
                      }}>
                      <Bell size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.lendingDetailText}>
                    {detail.borrower.name} pays {detail.lender.name}{' '}
                    <Text style={styles.amountStrongText}>{amountStr}</Text>
                  </Text>
                )}
              </View>
            </Card>
          );
        })}
        {hasActionable && (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={() => handleSettleUp()}
            style={styles.settleAllButton}>
            <Text style={styles.settleAllButtonText}>Settle Up</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSplitsList = () => {
    const splitsToShow = filteredSplits.slice(0, RECENT_SPLITS_LIMIT);
    const currentEmail = user?.email?.toLowerCase();
    return (
      <View style={styles.splitsList}>
        {filteredSplits.length > 0 ? (
          <>
            {splitsToShow.map(split => {
              const splitColor = getSplitCardColor(split, currentEmail, colors);
              return (
                <Card
                  key={split.id}
                  style={[
                    styles.splitCard,
                    Platform.OS === 'android' && styles.cardAndroid,
                  ]}
                  elevation={Platform.OS === 'android' ? 0 : 1}>
                  <TouchableOpacity
                    style={styles.splitCardContent}
                    onPress={() =>
                      router.navigate({
                        pathname: '/split/group/[groupId]/split/[splitId]',
                        params: {groupId: group!.id, splitId: split.id},
                      })
                    }>
                    <View
                      style={[
                        styles.splitColorBar,
                        {backgroundColor: splitColor},
                      ]}
                    />
                    <View style={styles.splitCardDetails}>
                      <Text style={styles.splitTitle}>{split.title}</Text>
                      <Text style={styles.splitSubtitle}>
                        Paid by {split.paidBy?.name || split.paidBy?.email}
                      </Text>
                      <Text style={styles.splitDate}>
                        {moment(
                          (split.date || split.createdAt)!.toDate(),
                        ).format('MMM D, YYYY')}
                      </Text>
                      {split.category && (
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryText}>
                            {split.category}
                          </Text>
                        </View>
                      )}
                      {split.recurring?.enabled && (
                        <View style={styles.recurringTag}>
                          <Repeat size={11} color={colors.primary} />
                          <Text style={styles.recurringTagText}>
                            {split.recurring.frequency === 'weekly'
                              ? 'Weekly'
                              : 'Monthly'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.splitCardRight}>
                      <Text style={[styles.splitAmount, {color: splitColor}]}>
                        {formatAmount(majorOf(split, currency.code))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            })}
            {filteredSplits.length > RECENT_SPLITS_LIMIT && (
              <TouchableOpacity
                onPress={() =>
                  router.navigate({
                    pathname: '/split/group/[groupId]/transactions',
                    params: {groupId: group!.id},
                  })
                }
                style={styles.showAllButton}>
                <Text style={styles.showAllText}>Show all transactions</Text>
                <ChevronRight size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={styles.noSplitsText}>No splits yet</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return <LoadingState message="Loading group details..." />;
  }

  if (failed) {
    return (
      <ErrorState
        title="Could not load this group"
        onRetry={splitsData.retry}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {renderGroupSummaryCard()}
          {renderStatsSummary()}
          {renderDetailedLendingSummary()}
          <View style={styles.splitsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Recent Splits</Text>
            </View>
            {renderSplitsList()}
          </View>
        </KeyboardAwareScrollView>
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            router.navigate({
              pathname: '/split/group/[groupId]/create',
              params: {groupId: group!.id},
            })
          }
          accessibilityLabel="Add split"
          accessibilityRole="button">
          <Plus size={28} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </SafeAreaProvider>
  );
};

export default SplitGroupDetailScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
    },
    scrollView: {flex: 1},
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    splitsSection: {paddingBottom: 30},
    groupSummaryCard: {
      backgroundColor: colors.primaryFill,
      padding: 20,
      marginTop: 20,
      marginBottom: 15,
    },
    cardContent: {alignItems: 'center'},
    titleText: {
      fontSize: 24,
      color: colors.onPrimary,
      marginBottom: 10,
      fontWeight: '600',
    },
    balanceText: {fontSize: 22, fontWeight: '500', color: colors.onPrimary},
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 15,
    },
    sectionHeaderText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    splitsList: {marginBottom: 30},
    splitCard: {
      marginBottom: 10,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    splitCardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'stretch',
    },
    splitColorBar: {width: 4, alignSelf: 'stretch'},
    splitCardDetails: {flex: 1, paddingVertical: 12, paddingHorizontal: 12},
    splitTitle: {fontSize: 16, fontWeight: '500', color: colors.text},
    splitSubtitle: {fontSize: 12, color: colors.textMuted, marginTop: 4},
    showAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      marginTop: 5,
    },
    showAllText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '500',
      marginRight: 5,
    },
    splitAmount: {fontSize: 16, fontWeight: '500', color: colors.primary},
    noSplitsText: {
      textAlign: 'center',
      color: colors.textMuted,
      marginTop: 20,
    },
    backButton: {
      marginTop: 20,
      padding: 10,
      backgroundColor: colors.primaryFill,
      borderRadius: 5,
    },
    lendingSummaryContainer: {marginTop: 15},
    lendingSummaryCard: {
      marginVertical: 10,
      padding: 15,
      backgroundColor: colors.surface,
    },
    lendingDetailText: {fontSize: 14, color: colors.text, marginBottom: 5},
    amountStrongText: {
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 6,
      color: colors.textStrong,
    },
    groupMemberAvatars: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 10,
    },
    groupMemberAvatar: {borderWidth: 2, borderColor: colors.onPrimary},
    memberWrapper: {alignItems: 'center', width: 64, marginHorizontal: 4},
    memberName: {
      color: colors.onPrimary,
      fontSize: 10,
      marginTop: 4,
      maxWidth: 56,
      textAlign: 'center',
    },
    extraMembersAvatar: {
      backgroundColor: 'rgba(255,255,255,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    extraMembersText: {color: colors.onPrimary, fontSize: 12},
    splitCardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 12,
    },
    lendingSummaryContent: {
      alignItems: 'center',
      padding: 15,
      position: 'relative',
    },
    actionButtonsRow: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'center',
      marginTop: 10,
      gap: 20,
    },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editButton: {backgroundColor: colors.surface},
    leaveButton: {backgroundColor: colors.surface},
    deleteButton: {backgroundColor: GROUP_CARD_DELETE_FILL},
    lendingUserContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    arrowIcon: {marginHorizontal: 10},
    splitDate: {fontSize: 12, color: colors.textMuted, marginTop: 2},
    categoryTag: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      marginTop: 5,
      alignSelf: 'flex-start',
    },
    categoryText: {fontSize: 12, color: colors.primary},
    settleAllButton: {
      marginTop: 10,
      minHeight: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryFill,
    },
    settleAllButtonText: {
      color: colors.onPrimary,
      fontFamily: 'Lato-Bold',
      fontSize: 15,
    },
    fab: {
      position: 'absolute',
      right: 24,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryFill,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: Platform.OS === 'android' ? 0 : 3,
      shadowColor: colors.primaryFill,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    remindIconButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      padding: 6,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
    },
    recurringTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4,
      alignSelf: 'flex-start',
    },
    recurringTagText: {
      fontSize: 11,
      color: colors.primary,
      fontFamily: 'Lato-Regular',
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
    statsRow: {flexDirection: 'row', marginBottom: 15, gap: 12},
    statCard: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    statCardContent: {
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 10,
    },
    statIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    statCardLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 3,
      fontFamily: 'Lato-Regular',
      textAlign: 'center',
    },
    statCardValue: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'Lato-Bold',
      textAlign: 'center',
    },
    pendingInvitesContainer: {
      width: '100%',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
    },
    pendingInvitesLabel: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      marginBottom: 6,
      fontWeight: '600',
    },
    pendingInviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 6,
    },
    pendingInviteEmail: {
      flex: 1,
      color: 'rgba(255,255,255,0.9)',
      fontSize: 12,
    },
    resendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    resendText: {color: colors.onPrimary, fontSize: 12},
  });
