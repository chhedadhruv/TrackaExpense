import React, {useMemo, useState} from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {ActivityIndicator} from 'react-native';
import Card from '../../src/components/Card';
import Text from '../../src/components/Text';
import UserCheck from 'lucide-react-native/icons/user-check';
import Users from 'lucide-react-native/icons/users';
import UserAvatar from '../../src/components/Avatar';
import {getAuth} from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import {useCurrency} from '../../utils/CurrencyUtil';
import {minorOf} from '../../src/utils/amounts';
import {toMajorNumber} from '../../src/utils/money';
import {sharesMinor} from '../../src/utils/splitMath';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import SplitNotificationService from '../../services/SplitNotificationService';
import {snackbar} from '../../src/utils/snackbarStore';
import {ErrorState, LoadingState} from '../../src/components/ScreenState';
import {useGroups, useGroupsSplits} from '../../src/data/split';

interface Balance {
  email: string;
  name: string;
  net: number;
  groups: {groupId: string; name: string; amount: number}[];
}

interface SplitDoc {
  id: string;
  type?: string;
  isSettlement?: boolean;
  amount: number | string;
  paidBy?: {email?: string; name?: string};
  splitUsers?: {email?: string; name?: string; percentage?: number}[];
  splitType?: string;
}

const calculateBalancesForSplits = (
  splits: SplitDoc[],
  currentEmail: string,
  currencyCode: string,
): {email: string; name: string; net: number}[] => {
  const netMap: Record<string, {email: string; name: string; net: number}> = {};
  splits.forEach(split => {
    if (split.type === 'settlement' || split.isSettlement) {
      const fromEmail = split.paidBy?.email?.toLowerCase();
      const toEmail = split.splitUsers?.[0]?.email?.toLowerCase();
      // Integer minor units; converted back to major units when the result is returned.
      const amount = minorOf(split, currencyCode) ?? 0;
      if (!fromEmail || !toEmail || fromEmail === toEmail) {
        return;
      }
      if (fromEmail === currentEmail) {
        if (!netMap[toEmail]) {
          netMap[toEmail] = {
            email: toEmail,
            name: split.splitUsers![0]?.name || toEmail.split('@')[0],
            net: 0,
          };
        }
        netMap[toEmail].net += amount;
      } else if (toEmail === currentEmail) {
        if (!netMap[fromEmail]) {
          netMap[fromEmail] = {
            email: fromEmail,
            name: split.paidBy?.name || fromEmail.split('@')[0],
            net: 0,
          };
        }
        netMap[fromEmail].net -= amount;
      }
      return;
    }
    const paidByEmail = split.paidBy?.email?.toLowerCase();
    const splitUsers = split.splitUsers || [];
    const shares = sharesMinor(split, currencyCode) ?? [];
    splitUsers.forEach((u, index) => {
      const uEmail = u.email?.toLowerCase();
      if (!uEmail || uEmail === paidByEmail) {
        return;
      }
      const share = shares[index] ?? 0;
      if (paidByEmail === currentEmail) {
        if (!netMap[uEmail]) {
          netMap[uEmail] = {
            email: uEmail,
            name: u.name || uEmail.split('@')[0],
            net: 0,
          };
        }
        netMap[uEmail].net += share;
      } else if (uEmail === currentEmail) {
        if (!netMap[paidByEmail!]) {
          netMap[paidByEmail!] = {
            email: paidByEmail!,
            name: split.paidBy?.name || paidByEmail!.split('@')[0],
            net: 0,
          };
        }
        netMap[paidByEmail!].net -= share;
      }
    });
  });
  // `net` is in minor units here (summed across groups by the caller); a balance under one
  // minor unit (0.01) counts as settled.
  return Object.values(netMap).filter(b => Math.abs(b.net) >= 1);
};

const FriendsBalanceScreen = () => {
  const {currency} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const fmtAmt = (amount: number) => {
    const num = Math.abs(parseFloat(String(amount)) || 0);
    const formatted = num.toLocaleString(currency.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${currency.symbol}${formatted}`;
  };
  const [refreshing, setRefreshing] = useState(false);
  const [remindingEmail, setRemindingEmail] = useState<string | null>(null);

  const groups = useGroups();
  const groupList = groups.data;
  const groupIds = useMemo(() => (groupList ?? []).map(g => g.id), [groupList]);
  const groupSplits = useGroupsSplits<SplitDoc>(groupIds);

  // Worked out from the cached splits, so a split added, settled or deleted anywhere changes the
  // balances at once. Summed across groups as integer minor units, converted to major units for
  // display.
  const balances = useMemo<Balance[]>(() => {
    if (!groupList || !groupSplits.data) {
      return [];
    }
    const currentEmail = getAuth().currentUser?.email?.toLowerCase() ?? '';
    const aggregated: Record<string, Balance> = {};
    const aggregatedMinor: Record<string, number> = {};
    groupList.forEach(group => {
      const bals = calculateBalancesForSplits(
        groupSplits.data?.[group.id] ?? [],
        currentEmail,
        currency.code,
      );
      bals.forEach(b => {
        if (!aggregated[b.email]) {
          aggregated[b.email] = {
            email: b.email,
            name: b.name,
            net: 0,
            groups: [],
          };
        }
        aggregatedMinor[b.email] = (aggregatedMinor[b.email] ?? 0) + b.net;
        aggregated[b.email].net = toMajorNumber(
          aggregatedMinor[b.email],
          currency.code,
        );
        aggregated[b.email].groups.push({
          groupId: group.id,
          name: group.name ?? '',
          amount: toMajorNumber(b.net, currency.code),
        });
      });
    });
    return Object.values(aggregated)
      .filter(b => Math.abs(b.net) > 0.009)
      .sort((x, y) => Math.abs(y.net) - Math.abs(x.net));
  }, [groupList, groupSplits.data, currency.code]);

  const loading = groups.loading || groupSplits.loading;
  // A failed load must not read as "All settled up": show the error state instead.
  const failed = groups.error || groupSplits.error;
  const live = groups.live && groupSplits.live;

  const handleRefresh = () => {
    setRefreshing(true);
    groups.retry();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleRemind = async (b: Balance) => {
    if (remindingEmail) {
      return;
    }
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      return;
    }
    // The reminder names an amount, so it is sent only from balances the server has confirmed.
    if (!live) {
      snackbar.info('Still syncing your balances. Try again in a moment.');
      return;
    }
    const lender = {
      email: currentUser.email ?? '',
      name:
        currentUser.displayName ||
        currentUser.email?.split('@')[0] ||
        'Someone',
    };
    const borrower = {email: b.email, name: b.name};
    // Friend owes the user in these groups (positive amount).
    const owingGroups = b.groups.filter(g => g.amount > 0.009);
    if (owingGroups.length === 0) {
      return;
    }
    setRemindingEmail(b.email);
    try {
      const results = await Promise.all(
        owingGroups.map(g =>
          SplitNotificationService.notifyPaymentReminder(
            {id: g.groupId, name: g.name} as any,
            borrower,
            lender,
            g.amount,
          ).catch(() => ({success: false, reason: 'error'})),
        ),
      );
      const sent = results.filter(r => r.success).length;
      const cooled = results.filter(
        r => !r.success && r.reason === 'cooldown',
      ).length;
      if (sent > 0) {
        snackbar.success(`${b.name} has been reminded to pay you.`);
      } else if (cooled > 0) {
        snackbar.error('You already reminded them in the last 24 hours.');
      } else {
        snackbar.error('Failed to send reminder.');
      }
    } finally {
      setRemindingEmail(null);
    }
  };

  if (loading) {
    return <LoadingState message="Loading balances..." />;
  }

  if (failed) {
    return (
      <ErrorState title="Could not load balances" onRetry={handleRefresh} />
    );
  }

  const totalOwed = balances
    .filter(b => b.net > 0)
    .reduce((s, b) => s + b.net, 0);
  const totalOwe = balances
    .filter(b => b.net < 0)
    .reduce((s, b) => s + Math.abs(b.net), 0);
  const net = totalOwed - totalOwe;
  const isPositive = net >= 0;

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <Users size={32} color={colors.primary} />
              <Text style={styles.headerTitle}>Friends & Balances</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Net balances across all your groups
            </Text>
          </View>
          {balances.length > 0 && (
            <Card
              style={[
                styles.totalCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.totalCardContent}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Overall you receive</Text>
                  <Text style={[styles.totalValue, {color: colors.incomeText}]}>
                    {fmtAmt(totalOwed)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Overall you owe</Text>
                  <Text
                    style={[styles.totalValue, {color: colors.expenseText}]}>
                    {fmtAmt(totalOwe)}
                  </Text>
                </View>
                <View style={styles.totalDivider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalNetLabel}>Net balance</Text>
                  <Text
                    style={[
                      styles.totalNetValue,
                      {
                        color: isPositive
                          ? colors.incomeText
                          : colors.expenseText,
                      },
                    ]}>
                    {isPositive ? '+ ' : '- '}
                    {fmtAmt(Math.abs(net))}
                  </Text>
                </View>
              </View>
            </Card>
          )}
          {balances.length === 0 ? (
            <Card
              style={[
                styles.emptyCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.emptyState}>
                <UserCheck size={64} color={colors.iconMuted} />
                <Text style={styles.emptyTitle}>All settled up!</Text>
                <Text style={styles.emptySubtitle}>
                  No outstanding balances across your groups
                </Text>
              </View>
            </Card>
          ) : (
            balances.map(b => {
              const owesYou = b.net > 0;
              const color = owesYou ? colors.incomeText : colors.expenseText;
              const label = owesYou ? 'owes you' : 'you owe';
              return (
                <Card
                  key={b.email}
                  style={[
                    styles.balanceCard,
                    Platform.OS === 'android' && styles.cardAndroid,
                  ]}
                  elevation={Platform.OS === 'android' ? 0 : 1}>
                  <View style={styles.balanceCardContent}>
                    <UserAvatar size={44} name={b.name} />
                    <View style={styles.balanceInfo}>
                      <Text style={styles.balanceName}>{b.name}</Text>
                      <Text style={[styles.balanceLabel, {color}]}>
                        {label}
                      </Text>
                      {b.groups
                        .filter(g => Math.abs(g.amount) > 0.009)
                        .map((g, i) => (
                          <Text key={i} style={styles.groupBreakdown}>
                            {g.name}: {g.amount > 0 ? '+ ' : '- '}
                            {fmtAmt(g.amount)}
                          </Text>
                        ))}
                    </View>
                    <View style={styles.balanceRight}>
                      <Text style={[styles.balanceAmount, {color}]}>
                        {fmtAmt(b.net)}
                      </Text>
                      {owesYou && (
                        <TouchableOpacity
                          style={styles.remindButton}
                          disabled={remindingEmail === b.email}
                          onPress={() => handleRemind(b)}>
                          {remindingEmail === b.email ? (
                            <ActivityIndicator
                              size={14}
                              color={colors.primary}
                            />
                          ) : (
                            <Text style={styles.remindButtonText}>Remind</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default FriendsBalanceScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
    headerSection: {
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 30,
      paddingBottom: 20,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      fontFamily: 'Kufam-SemiBoldItalic',
      marginLeft: 12,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginHorizontal: 20,
      marginTop: 20,
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
    emptyState: {alignItems: 'center', paddingVertical: 50},
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 15,
      fontFamily: 'Lato-Bold',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 5,
      fontFamily: 'Lato-Regular',
    },
    totalCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 20,
      marginBottom: 16,
    },
    totalCardContent: {padding: 16},
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    totalLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
    },
    totalValue: {fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold'},
    totalDivider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: 8,
    },
    totalNetLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    totalNetValue: {
      fontSize: 16,
      fontWeight: 'bold',
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    balanceCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 20,
      marginBottom: 12,
    },
    balanceCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    balanceInfo: {flex: 1, marginLeft: 14},
    balanceName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    balanceLabel: {fontSize: 13, fontFamily: 'Lato-Regular', marginTop: 2},
    groupBreakdown: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: 'Lato-Regular',
      marginTop: 1,
    },
    balanceRight: {alignItems: 'flex-end'},
    balanceAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    remindButton: {
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
    },
    remindButtonText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: 'Lato-Bold',
      fontWeight: '600',
    },
  });
