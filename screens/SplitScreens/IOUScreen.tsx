import React, {useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import {Text, Card, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import UserAvatar from '../../src/components/Avatar';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import {lookupUserByEmail} from '../../src/services/UserLookup';
import {getAuth} from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import {useFocusEffect, useRouter} from 'expo-router';
import {useCurrency} from '../../utils/CurrencyUtil';
import {majorOf, transactionMoneyFields} from '../../src/utils/amounts';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {
  NOTIFICATION_SERVER_URL,
  EXPO_PUBLIC_NOTIFICATION_SERVER_URL,
} from '@env';
import {snackbar} from '../../src/utils/snackbarStore';
import {ErrorState, LoadingState} from '../../src/components/ScreenState';
import {useLoadFailure} from '../../src/hooks/useLoadFailure';

interface IOU {
  id: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  amount: number;
  notes?: string;
  status: string;
  createdAt?: {toDate: () => Date};
}

type Tab = 'iowe' | 'owedtome';

const IOUScreen = () => {
  const router = useRouter();
  const {currency, formatAmount} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<Tab>('iowe');
  const [loading, setLoading] = useState(true);
  const {failed, succeed, fail} = useLoadFailure();
  const [refreshing, setRefreshing] = useState(false);
  const [iOwe, setIOwe] = useState<IOU[]>([]);
  const [owedToMe, setOwedToMe] = useState<IOU[]>([]);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const loadIOUs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const currentUser = getAuth().currentUser;
        if (!currentUser) {
          return;
        }
        const email = currentUser.email?.toLowerCase();
        const [fromSnap, toSnap] = await Promise.all([
          getDocs(
            query(
              collection(getFirestore(), 'ious'),
              where('fromEmail', '==', email),
              where('status', '==', 'pending'),
              orderBy('createdAt', 'desc'),
            ),
          ),
          getDocs(
            query(
              collection(getFirestore(), 'ious'),
              where('toEmail', '==', email),
              where('status', '==', 'pending'),
              orderBy('createdAt', 'desc'),
            ),
          ),
        ]);
        setIOwe(fromSnap.docs.map(d => ({id: d.id, ...d.data()} as IOU)));
        setOwedToMe(toSnap.docs.map(d => ({id: d.id, ...d.data()} as IOU)));
        succeed();
      } catch (e) {
        // A failed load must not read as "You owe nothing": show the error state instead.
        fail(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [succeed, fail],
  );

  useFocusEffect(
    useCallback(() => {
      loadIOUs();
    }, [loadIOUs]),
  );

  const settleIOU = async (iou: IOU) => {
    if (settlingId) {
      return;
    }
    setSettlingId(iou.id);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        return;
      }
      const currentEmail = currentUser.email?.toLowerCase();
      // Rounded to the minor unit once; the transaction and the balance change agree exactly.
      const amount = majorOf(iou, currency.code);
      const todayStr = new Date().toISOString().split('T')[0];
      const isDebtor = iou.fromEmail?.toLowerCase() === currentEmail;
      const counterpartyEmail = (
        isDebtor ? iou.toEmail : iou.fromEmail
      )?.toLowerCase();
      const counterpartyName = isDebtor
        ? iou.toName || iou.toEmail
        : iou.fromName || iou.fromEmail;
      const currentUserName =
        currentUser.displayName || currentEmail?.split('@')[0] || 'Me';

      await updateDoc(doc(getFirestore(), 'ious', iou.id), {
        status: 'settled',
        settledAt: serverTimestamp(),
      });

      if (amount > 0) {
        // Current user: debtor pays (expense), creditor receives (income).
        try {
          await addDoc(
            collection(
              getFirestore(),
              'users',
              currentUser.uid,
              'transactions',
            ),
            {
              title: iou.notes?.trim() || `IOU: ${counterpartyName}`,
              type: isDebtor ? 'expense' : 'income',
              category: 'IOU',
              amount: String(amount),
              ...transactionMoneyFields(String(amount), currency.code),
              date: todayStr,
              source: 'iou',
              iouId: iou.id,
              splitRole: isDebtor ? 'iou_payer' : 'iou_receiver',
              createdAt: serverTimestamp(),
            },
          );
          await updateDoc(doc(getFirestore(), 'users', currentUser.uid), {
            balance: increment(isDebtor ? -amount : amount),
          });
        } catch (_) {}

        // Counterparty (opposite entry) via notification server, if registered.
        let counterpartyUserId: string | null = null;
        if (counterpartyEmail) {
          try {
            const found = await lookupUserByEmail(counterpartyEmail);
            counterpartyUserId = found?.uid ?? null;
          } catch (_) {}
        }
        if (counterpartyUserId) {
          try {
            const endpoint =
              NOTIFICATION_SERVER_URL ||
              EXPO_PUBLIC_NOTIFICATION_SERVER_URL ||
              '';
            if (endpoint) {
              await fetch(
                `${endpoint.replace(/\/$/, '')}/createSplitTransaction`,
                {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({
                    targetUserId: counterpartyUserId,
                    txData: {
                      title: iou.notes?.trim() || `IOU: ${currentUserName}`,
                      type: isDebtor ? 'income' : 'expense',
                      category: 'IOU',
                      amount: String(amount),
                      ...transactionMoneyFields(String(amount), currency.code),
                      date: todayStr,
                      source: 'iou',
                      iouId: iou.id,
                      splitRole: isDebtor ? 'iou_receiver' : 'iou_payer',
                    },
                    balanceDelta: isDebtor ? amount : -amount,
                  }),
                },
              );
            }
          } catch (_) {}
        }
      }
      loadIOUs(true);
    } catch (_) {
      snackbar.error('Failed to mark as settled');
    } finally {
      setSettlingId(null);
    }
  };

  const markSettled = (iou: IOU) => {
    Alert.alert(
      'Mark Settled',
      'Mark this IOU as settled? This records matching income/expense entries and updates both balances.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Settle', onPress: () => settleIOU(iou)},
      ],
    );
  };

  const renderIOU = (iou: IOU, isDebtor: boolean) => {
    const name = isDebtor
      ? iou.toName || iou.toEmail
      : iou.fromName || iou.fromEmail;
    const color = isDebtor ? colors.expenseText : colors.incomeText;
    const labelPrefix = isDebtor ? 'To' : 'From';
    const date = iou.createdAt?.toDate?.()?.toLocaleDateString() || '';
    return (
      <Card
        key={iou.id}
        style={[
          styles.iouCard,
          Platform.OS === 'android' && styles.cardAndroid,
        ]}
        elevation={Platform.OS === 'android' ? 0 : 1}>
        <View style={styles.iouCardContent}>
          <UserAvatar size={44} name={name} />
          <View style={styles.iouInfo}>
            <Text style={styles.iouName}>{name}</Text>
            <Text style={styles.iouLabel}>
              {labelPrefix}: {iou.toEmail || iou.fromEmail}
            </Text>
            {iou.notes ? (
              <Text style={styles.iouNotes} numberOfLines={2}>
                {iou.notes}
              </Text>
            ) : null}
            <Text style={styles.iouDate}>{date}</Text>
          </View>
          <View style={styles.iouRight}>
            <Text style={[styles.iouAmount, {color}]}>
              {formatAmount(majorOf(iou, currency.code))}
            </Text>
            <TouchableOpacity
              onPress={() => markSettled(iou)}
              disabled={settlingId === iou.id}
              style={styles.settleButton}>
              {settlingId === iou.id ? (
                <ActivityIndicator size={16} color={colors.onPrimary} />
              ) : (
                <Text style={styles.settleButtonText}>Settle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  const activeList = tab === 'iowe' ? iOwe : owedToMe;
  const isDebtor = tab === 'iowe';

  if (loading) {
    return <LoadingState message="Loading IOUs..." />;
  }

  if (failed) {
    return (
      <ErrorState title="Could not load IOUs" onRetry={() => loadIOUs()} />
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadIOUs(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons
                name="handshake"
                size={32}
                color={colors.primary}
              />
              <Text style={styles.headerTitle}>IOUs</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Track personal debts without a group
            </Text>
          </View>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, tab === 'iowe' && styles.tabActive]}
              onPress={() => setTab('iowe')}>
              <Text
                style={[
                  styles.tabText,
                  tab === 'iowe' && styles.tabTextActive,
                ]}>
                I Owe ({iOwe.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'owedtome' && styles.tabActive]}
              onPress={() => setTab('owedtome')}>
              <Text
                style={[
                  styles.tabText,
                  tab === 'owedtome' && styles.tabTextActive,
                ]}>
                Owed to Me ({owedToMe.length})
              </Text>
            </TouchableOpacity>
          </View>
          {activeList.length === 0 ? (
            <Card
              style={[
                styles.emptyCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="handshake"
                  size={64}
                  color={colors.iconMuted}
                />
                <Text style={styles.emptyTitle}>
                  {tab === 'iowe' ? 'You owe nothing!' : 'Nobody owes you'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  Tap + to record a new IOU
                </Text>
              </View>
            </Card>
          ) : (
            activeList.map(iou => renderIOU(iou, isDebtor))
          )}
          <View style={styles.listSpacer} />
        </KeyboardAwareScrollView>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.navigate('/split/iou/new')}>
          <MaterialCommunityIcons
            name="plus"
            size={28}
            color={colors.onPrimary}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaProvider>
  );
};

export default IOUScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
    listSpacer: {height: 80},
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
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 15,
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    tabActive: {backgroundColor: colors.primaryFill},
    tabText: {fontSize: 14, color: colors.primary, fontFamily: 'Lato-Bold'},
    tabTextActive: {color: colors.onPrimary},
    iouCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 20,
      marginBottom: 12,
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
    iouCardContent: {flexDirection: 'row', alignItems: 'center', padding: 16},
    iouInfo: {flex: 1, marginLeft: 14},
    iouName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    iouLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'Lato-Regular',
      marginTop: 1,
    },
    iouNotes: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
      marginTop: 3,
    },
    iouDate: {
      fontSize: 11,
      color: colors.textPlaceholder,
      fontFamily: 'Lato-Regular',
      marginTop: 2,
    },
    iouRight: {alignItems: 'flex-end'},
    iouAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    settleButton: {
      marginTop: 8,
      backgroundColor: colors.incomeFill,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
    },
    settleButtonText: {
      fontSize: 12,
      color: colors.onPrimary,
      fontFamily: 'Lato-Bold',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginHorizontal: 20,
      marginTop: 20,
    },
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
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryFill,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: Platform.OS === 'android' ? 0 : 4,
      ...(Platform.OS !== 'android' && {
        shadowColor: colors.shadow,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.25,
        shadowRadius: 4,
      }),
    },
  });
