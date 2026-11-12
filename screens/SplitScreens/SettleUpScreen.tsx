import React, {useState, useEffect, useRef} from 'react';
import {useRouter} from 'expo-router';
import type {LendingDetail} from '../../src/utils/lending';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import {Card, Switch} from 'react-native-paper';
import UserAvatar from '../../src/components/Avatar';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {recordSettlement} from '../../src/services/SettlementService';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Handshake from 'lucide-react-native/icons/handshake';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../../src/services/ErrorReporter';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import SplitNotificationService from '../../services/SplitNotificationService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import {useCurrency} from '../../utils/CurrencyUtil';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {formatInputAmount} from '../../src/utils/formatters';
import {toMajorNumber, tryToMinor} from '../../src/utils/money';
import {snackbar} from '../../src/utils/snackbarStore';

interface GroupMember {
  email: string;
  name: string;
  avatar?: string | null;
  userId?: string | null;
}

interface Group {
  id: string;
  name: string;
  members: GroupMember[];
}

export interface SettleUpScreenProps {
  /** The group with its members already resolved (name, avatar, user id). */
  group: Group;
  /** Net balances between members, shown as suggestions (see src/utils/lending.ts). */
  lendingDetails?: LendingDetail[];
  /** The pair and amount to prefill, chosen by the route that opened this screen. */
  preselect?: {
    borrower: {email: string};
    lender: {email: string};
    amount: number;
  };
}

const SettleUpScreen = ({
  group,
  lendingDetails,
  preselect,
}: SettleUpScreenProps) => {
  const {currency, formatAmount} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedLender, setSelectedLender] = useState<GroupMember | null>(
    null,
  );
  const [selectedBorrower, setSelectedBorrower] = useState<GroupMember | null>(
    null,
  );
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [includeInTransactions, setIncludeInTransactions] = useState(true);
  // Kept across a failed attempt so a retry cannot record the settlement twice.
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const members = group.members || [];
    if (preselect) {
      setSelectedBorrower(
        members.find(m => m.email === preselect.borrower.email) ?? null,
      );
      setSelectedLender(
        members.find(m => m.email === preselect.lender.email) ?? null,
      );
      setAmount(preselect.amount.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSettleUp = async () => {
    if (loading) {
      return;
    }
    if (!selectedLender || !selectedBorrower || !amount) {
      snackbar.error('Please fill in all required fields');
      return;
    }
    if (note.trim().length > 200) {
      snackbar.error('Note must be 200 characters or less');
      return;
    }
    const typedAmount = parseFloat(amount);
    if (isNaN(typedAmount) || typedAmount <= 0) {
      snackbar.error('Please enter a valid amount');
      return;
    }
    if (typedAmount > 999999999) {
      snackbar.error('Amount must be less than 999,999,999');
      return;
    }
    // Everything below uses the amount rounded to the currency's minor unit, so the documents,
    // the transactions and both balance changes agree to the paisa.
    const settlementMinor = tryToMinor(amount, currency.code);
    if (settlementMinor === null || settlementMinor <= 0) {
      snackbar.error('Please enter a valid amount');
      return;
    }
    const settlementAmount = toMajorNumber(settlementMinor, currency.code);
    try {
      setLoading(true);
      const currentUser = getAuth().currentUser!;
      const currentUserEmail = currentUser.email;
      let actorNameResolved = currentUserEmail?.split('@')[0] || 'Someone';
      try {
        const userDoc = await getDoc(
          doc(getFirestore(), 'users', currentUser.uid),
        );
        const profileName = userDoc.data()?.name;
        if (profileName && profileName.toLowerCase() !== 'me') {
          actorNameResolved = profileName;
        }
      } catch (_) {}

      // The server records the whole settlement in one step: the settlement, the splits-list
      // entry, both balances and the transactions. The same request id is kept for a retry after
      // a failure, so the settlement can never be applied twice.
      if (!requestIdRef.current) {
        requestIdRef.current = doc(
          collection(getFirestore(), 'groups', group.id, 'splits'),
        ).id;
      }
      const recorded = await recordSettlement({
        groupId: group.id,
        fromEmail: selectedBorrower.email,
        toEmail: selectedLender.email,
        amount,
        note: note.trim(),
        includeInTransactions,
        requestId: requestIdRef.current,
      });
      const splitRef = {id: recorded.splitId};
      const splitTitle = note.trim() || 'Settlement Payment';

      SplitNotificationService.notifySettlementMade(
        {
          id: group.id,
          name: group.name,
          members: (group.members || []).map((m: GroupMember) => m.email || m),
        } as any,
        {id: splitRef.id, amount: settlementAmount} as any,
        actorNameResolved,
      ).catch(() => {});

      const historyPayload = {
        type: 'settlement_create',
        groupId: group.id,
        groupName: group.name,
        splitId: splitRef.id,
        splitTitle,
        amount: settlementAmount,
        category: 'Settlement',
        date: serverTimestamp(),
        paidBy: selectedBorrower,
        splitType: 'settlement',
        settlement: {
          from: selectedBorrower,
          to: selectedLender,
          amount: settlementAmount,
          note: note.trim(),
        },
        actorUid: currentUser.uid,
        actorEmail: currentUserEmail,
        actorName: actorNameResolved,
        createdAt: serverTimestamp(),
      };
      try {
        await addDoc(
          collection(getFirestore(), 'users', currentUser.uid, 'splitHistory'),
          historyPayload,
        );
        await addDoc(
          collection(getFirestore(), 'groups', group.id, 'splitHistory'),
          historyPayload,
        );
      } catch (histErr) {}

      AnalyticsService.logSettleUp(
        AnalyticsService.getAmountRange(settlementAmount),
      );
      requestIdRef.current = null;
      snackbar.success('Settlement recorded successfully');
      router.back();
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  const renderUserSelectionCard = (
    title: string,
    selectedUser: GroupMember | null,
    users: GroupMember[],
    onSelect: (u: GroupMember | null) => void,
    excludeUser: GroupMember | null,
  ) => (
    <Card
      style={[
        styles.sectionCard,
        Platform.OS === 'android' && styles.cardAndroid,
      ]}
      elevation={Platform.OS === 'android' ? 0 : 1}>
      <View style={styles.cardContent}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.userList}>
            {users
              .filter(u => u.email !== excludeUser?.email)
              .map(u => (
                <TouchableOpacity
                  key={u.email}
                  style={[
                    styles.userItem,
                    selectedUser?.email === u.email && styles.selectedUserItem,
                  ]}
                  onPress={() =>
                    onSelect(selectedUser?.email === u.email ? null : u)
                  }>
                  <UserAvatar
                    size={50}
                    name={u.name}
                    src={u.avatar}
                    style={styles.userAvatar}
                    bgColor={
                      selectedUser?.email === u.email
                        ? colors.primaryFill
                        : colors.iconMuted
                    }
                  />
                  <Text
                    style={[
                      styles.userName,
                      selectedUser?.email === u.email &&
                        styles.selectedUserName,
                    ]}>
                    {u.name}
                  </Text>
                  {selectedUser?.email === u.email && (
                    <View style={styles.checkIcon}>
                      <CircleCheck size={20} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
          </View>
        </ScrollView>
      </View>
    </Card>
  );

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <Handshake size={32} color={colors.success} />
              <Text style={styles.headerTitle}>Settle Up</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Record payments between group members
            </Text>
          </View>
          {(lendingDetails?.length ?? 0) > 0 && (
            <Card
              style={[
                styles.sectionCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 1}>
              <View style={styles.cardContent}>
                <Text style={styles.sectionTitle}>Suggestions</Text>
                {lendingDetails!.map((item, idx) => {
                  const currentEmail = getAuth().currentUser?.email;
                  const isActive =
                    selectedBorrower?.email === item.borrower.email &&
                    selectedLender?.email === item.lender.email;
                  const isMyDebt = item.borrower.email === currentEmail;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.suggestionCard,
                        isActive && styles.suggestionCardActive,
                      ]}
                      onPress={() => {
                        const members = group.members || [];
                        setSelectedBorrower(
                          members.find(m => m.email === item.borrower.email) ??
                            null,
                        );
                        setSelectedLender(
                          members.find(m => m.email === item.lender.email) ??
                            null,
                        );
                        setAmount(item.amount.toString());
                      }}>
                      <View style={styles.suggestionLeft}>
                        {isMyDebt && (
                          <View style={styles.youPayBadge}>
                            <Text style={styles.youPayText}>You pay</Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.suggestionText,
                            isActive && styles.suggestionTextActive,
                          ]}>
                          {item.borrower.name} → {item.lender.name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.suggestionAmount,
                          isActive && styles.suggestionAmountActive,
                        ]}>
                        {formatAmount(item.amount)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          )}
          {renderUserSelectionCard(
            'Who paid?',
            selectedBorrower,
            group.members || [],
            setSelectedBorrower,
            selectedLender,
          )}
          {renderUserSelectionCard(
            'To whom?',
            selectedLender,
            group.members || [],
            setSelectedLender,
            selectedBorrower,
          )}
          <Card
            style={[
              styles.sectionCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <TextInput
                style={styles.textInput}
                value={formatInputAmount(amount)}
                onChangeText={text => setAmount(text.replace(/,/g, ''))}
                keyboardType="numeric"
                placeholder={`${currency.symbol}0`}
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>
          </Card>
          <Card
            style={[
              styles.sectionCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Add a note (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note for this settlement"
                placeholderTextColor={colors.textPlaceholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={styles.characterCount}>{note.length}/200</Text>
            </View>
          </Card>
          <Card
            style={[
              styles.sectionCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Add to my transactions</Text>
                  <Text style={styles.toggleSubtext}>
                    Record your share as a personal expense
                  </Text>
                </View>
                <Switch
                  value={includeInTransactions}
                  onValueChange={setIncludeInTransactions}
                  color={colors.primaryFill}
                />
              </View>
            </View>
          </Card>
          {selectedLender && selectedBorrower && amount ? (
            <Card
              style={[
                styles.sectionCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 1}>
              <View style={styles.cardContent}>
                <Text style={styles.sectionTitle}>Summary</Text>
                <View style={styles.summaryContent}>
                  <View style={styles.summaryRow}>
                    <UserAvatar
                      size={40}
                      name={selectedBorrower.name}
                      bgColor={colors.expenseFill}
                    />
                    <View style={styles.arrowIcon}>
                      <ArrowRight size={24} color={colors.textSecondary} />
                    </View>
                    <UserAvatar
                      size={40}
                      name={selectedLender.name}
                      bgColor={colors.incomeFill}
                    />
                  </View>
                  <Text style={styles.summaryText}>
                    {selectedBorrower.name} pays{' '}
                    {formatAmount(parseFloat(amount))} to {selectedLender.name}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.settleButton,
                (!selectedLender || !selectedBorrower || !amount) &&
                  styles.disabledButton,
              ]}
              onPress={handleSettleUp}
              disabled={
                loading || !selectedLender || !selectedBorrower || !amount
              }>
              <Handshake size={20} color={colors.onPrimary} />
              <Text style={styles.settleButtonText}>
                {loading ? 'Processing...' : 'Settle Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default SettleUpScreen;

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
      color: colors.success,
      fontFamily: 'Kufam-SemiBoldItalic',
      marginLeft: 12,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 20,
      marginBottom: 15,
    },
    cardContent: {padding: 20},
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 15,
      fontFamily: 'Lato-Bold',
    },
    userList: {flexDirection: 'row', paddingVertical: 8},
    userItem: {
      alignItems: 'center',
      marginRight: 16,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surfaceMuted,
      width: 90,
      position: 'relative',
    },
    selectedUserItem: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderWidth: 2,
    },
    userAvatar: {marginBottom: 8},
    userName: {
      fontSize: 12,
      textAlign: 'center',
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
      fontWeight: '500',
    },
    selectedUserName: {
      color: colors.primary,
      fontWeight: '600',
      fontFamily: 'Lato-Bold',
    },
    checkIcon: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 2,
      elevation: Platform.OS === 'android' ? 0 : 1,
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    textInput: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    multilineInput: {height: 80, paddingTop: 12},
    summaryContent: {alignItems: 'center'},
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    summaryText: {
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
      textAlign: 'center',
      lineHeight: 24,
    },
    arrowIcon: {marginHorizontal: 15},
    buttonContainer: {paddingHorizontal: 20, paddingBottom: 30},
    settleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.incomeFill,
      paddingVertical: 15,
      borderRadius: 12,
      elevation: Platform.OS === 'android' ? 0 : 1,
      shadowColor: colors.incomeFill,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.15,
      shadowRadius: 2,
    },
    disabledButton: {
      backgroundColor: colors.iconMuted,
      elevation: 0,
      shadowOpacity: 0,
    },
    settleButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
      fontFamily: 'Lato-Bold',
    },
    characterCount: {
      fontSize: 12,
      color: colors.textPlaceholder,
      marginTop: 4,
      textAlign: 'right',
      fontFamily: 'Lato-Regular',
    },
    suggestionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 10,
    },
    suggestionCardActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderWidth: 2,
    },
    suggestionLeft: {flex: 1, gap: 4},
    suggestionText: {
      fontSize: 14,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    suggestionTextActive: {color: colors.primary, fontFamily: 'Lato-Bold'},
    suggestionAmount: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.expenseText,
      fontFamily: 'Lato-Bold',
      marginLeft: 12,
    },
    suggestionAmountActive: {color: colors.primary},
    youPayBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.expenseSoft,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    youPayText: {
      fontSize: 11,
      color: colors.expenseText,
      fontFamily: 'Lato-Bold',
      fontWeight: '700',
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    toggleSubtext: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'Lato-Regular',
      marginTop: 2,
    },
  });
