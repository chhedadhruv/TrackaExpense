import React, {useState, useCallback} from 'react';
import {View, StyleSheet, RefreshControl, TouchableOpacity, Platform} from 'react-native';
import {Text, Card, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from 'react-native-user-avatar';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useFocusEffect} from '@react-navigation/native';
import {useCurrency} from '../../utils/CurrencyUtil';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';

const FriendsBalanceScreen = () => {
  const {currency} = useCurrency();
  const fmtAmt = amount => {
    const num = Math.abs(parseFloat(amount) || 0);
    const formatted = num.toLocaleString(currency.locale, {minimumFractionDigits: 0, maximumFractionDigits: 2});
    return `${currency.symbol}${formatted}`;
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState([]);

  const calculateBalancesForSplits = (splits, currentEmail) => {
    const netMap = {};
    splits.forEach(split => {
      if (split.type === 'settlement' || split.isSettlement) {
        const fromEmail = split.paidBy?.email?.toLowerCase();
        const toEmail = split.splitUsers?.[0]?.email?.toLowerCase();
        const amount = parseFloat(split.amount) || 0;
        if (!fromEmail || !toEmail || fromEmail === toEmail) return;
        if (fromEmail === currentEmail) {
          const key = toEmail;
          if (!netMap[key]) netMap[key] = {email: toEmail, name: split.splitUsers[0]?.name || toEmail.split('@')[0], net: 0};
          netMap[key].net += amount;
        } else if (toEmail === currentEmail) {
          const key = fromEmail;
          if (!netMap[key]) netMap[key] = {email: fromEmail, name: split.paidBy?.name || fromEmail.split('@')[0], net: 0};
          netMap[key].net -= amount;
        }
        return;
      }
      const paidByEmail = split.paidBy?.email?.toLowerCase();
      const splitUsers = split.splitUsers || [];
      const amount = parseFloat(split.amount) || 0;
      const splitPerUser = split.splitType === 'percentage' ? null : amount / splitUsers.length;
      splitUsers.forEach(u => {
        const uEmail = u.email?.toLowerCase();
        if (!uEmail || uEmail === paidByEmail) return;
        const share = split.splitType === 'percentage' ? amount * ((u.percentage || 0) / 100) : splitPerUser;
        if (paidByEmail === currentEmail) {
          if (!netMap[uEmail]) netMap[uEmail] = {email: uEmail, name: u.name || uEmail.split('@')[0], net: 0};
          netMap[uEmail].net += share;
        } else if (uEmail === currentEmail) {
          if (!netMap[paidByEmail]) netMap[paidByEmail] = {email: paidByEmail, name: split.paidBy?.name || paidByEmail.split('@')[0], net: 0};
          netMap[paidByEmail].net -= share;
        }
      });
    });
    return Object.values(netMap).filter(b => Math.abs(b.net) > 0.009);
  };

  const loadBalances = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const currentEmail = currentUser.email?.toLowerCase();
      const groupsSnap = await firestore()
        .collection('groups')
        .where('members', 'array-contains', currentUser.email)
        .get();
      const allSplits = (
        await Promise.all(
          groupsSnap.docs.map(g =>
            firestore()
              .collection('groups')
              .doc(g.id)
              .collection('splits')
              .get()
              .then(s => s.docs.map(d => ({id: d.id, groupId: g.id, groupName: g.data()?.name, ...d.data()})))
          )
        )
      ).flat();
      const aggregated = {};
      const perGroupBalances = {};
      allSplits.forEach(split => {
        const groupKey = split.groupId;
        if (!perGroupBalances[groupKey]) perGroupBalances[groupKey] = {name: split.groupName, splits: []};
        perGroupBalances[groupKey].splits.push(split);
      });
      Object.values(perGroupBalances).forEach(({name: groupName, splits: groupSplits}) => {
        const bals = calculateBalancesForSplits(groupSplits, currentEmail);
        bals.forEach(b => {
          if (!aggregated[b.email]) aggregated[b.email] = {email: b.email, name: b.name, net: 0, groups: []};
          aggregated[b.email].net += b.net;
          aggregated[b.email].groups.push({name: groupName, amount: b.net});
        });
      });
      const result = Object.values(aggregated)
        .filter(b => Math.abs(b.net) > 0.009)
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
      setBalances(result);
    } catch (_) {
      setBalances([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadBalances();
  }, [loadBalances]));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading balances...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadBalances(true)} colors={[PRIMARY_COLOR]} tintColor={PRIMARY_COLOR} />}>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="account-multiple" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.headerTitle}>Friends & Balances</Text>
            </View>
            <Text style={styles.headerSubtitle}>Net balances across all your groups</Text>
          </View>
          {balances.length > 0 && (() => {
            const totalOwed = balances.filter(b => b.net > 0).reduce((s, b) => s + b.net, 0);
            const totalOwe = balances.filter(b => b.net < 0).reduce((s, b) => s + Math.abs(b.net), 0);
            const net = totalOwed - totalOwe;
            const isPositive = net >= 0;
            return (
              <Card style={[styles.totalCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 2}>
                <View style={styles.totalCardContent}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Overall you receive</Text>
                    <Text style={[styles.totalValue, {color: SUCCESS_COLOR}]}>{fmtAmt(totalOwed)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Overall you owe</Text>
                    <Text style={[styles.totalValue, {color: EXPENSE_COLOR}]}>{fmtAmt(totalOwe)}</Text>
                  </View>
                  <View style={[styles.totalDivider]} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalNetLabel}>Net balance</Text>
                    <Text style={[styles.totalNetValue, {color: isPositive ? SUCCESS_COLOR : EXPENSE_COLOR}]}>
                      {isPositive ? '+ ' : '- '}{fmtAmt(Math.abs(net))}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })()}
          {balances.length === 0 ? (
            <Card style={[styles.emptyCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="account-check" size={64} color="#CBD3EE" />
                <Text style={styles.emptyTitle}>All settled up!</Text>
                <Text style={styles.emptySubtitle}>No outstanding balances across your groups</Text>
              </View>
            </Card>
          ) : (
            balances.map(b => {
              const owesYou = b.net > 0;
              const color = owesYou ? SUCCESS_COLOR : EXPENSE_COLOR;
              const label = owesYou ? `owes you` : `you owe`;
              return (
                <Card key={b.email} style={[styles.balanceCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
                  <View style={styles.balanceCardContent}>
                    <UserAvatar size={44} name={b.name} />
                    <View style={styles.balanceInfo}>
                      <Text style={styles.balanceName}>{b.name}</Text>
                      <Text style={[styles.balanceLabel, {color}]}>{label}</Text>
                      {b.groups.filter(g => Math.abs(g.amount) > 0.009).map((g, i) => (
                        <Text key={i} style={styles.groupBreakdown}>
                          {g.name}: {g.amount > 0 ? '+ ' : '- '}{fmtAmt(g.amount)}
                        </Text>
                      ))}
                    </View>
                    <Text style={[styles.balanceAmount, {color}]}>{fmtAmt(b.net)}</Text>
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR},
  loadingText: {fontSize: 16, color: PRIMARY_COLOR, marginTop: 15, fontFamily: 'Lato-Regular'},
  headerSection: {alignItems: 'center', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20},
  headerTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  headerTitle: {fontSize: 28, fontWeight: 'bold', color: PRIMARY_COLOR, fontFamily: 'Kufam-SemiBoldItalic', marginLeft: 12},
  headerSubtitle: {fontSize: 16, color: '#666', textAlign: 'center', fontFamily: 'Lato-Regular'},
  emptyCard: {backgroundColor: '#FFFFFF', borderRadius: 20, marginHorizontal: 20, marginTop: 20},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  emptyState: {alignItems: 'center', paddingVertical: 50},
  emptyTitle: {fontSize: 18, fontWeight: '600', color: '#666', marginTop: 15, fontFamily: 'Lato-Bold'},
  emptySubtitle: {fontSize: 14, color: '#888', textAlign: 'center', marginTop: 5, fontFamily: 'Lato-Regular'},
  totalCard: {backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 20, marginBottom: 16},
  totalCardContent: {padding: 16},
  totalRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4},
  totalLabel: {fontSize: 14, color: '#666', fontFamily: 'Lato-Regular'},
  totalValue: {fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold'},
  totalDivider: {height: 1, backgroundColor: '#E8EBF7', marginVertical: 8},
  totalNetLabel: {fontSize: 15, fontWeight: '700', color: '#2C2C2C', fontFamily: 'Lato-Bold'},
  totalNetValue: {fontSize: 16, fontWeight: 'bold', fontFamily: 'Kufam-SemiBoldItalic'},
  balanceCard: {backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 20, marginBottom: 12},
  balanceCardContent: {flexDirection: 'row', alignItems: 'center', padding: 16},
  balanceInfo: {flex: 1, marginLeft: 14},
  balanceName: {fontSize: 16, fontWeight: '600', color: '#2C2C2C', fontFamily: 'Lato-Bold'},
  balanceLabel: {fontSize: 13, fontFamily: 'Lato-Regular', marginTop: 2},
  groupBreakdown: {fontSize: 11, color: '#888', fontFamily: 'Lato-Regular', marginTop: 1},
  balanceAmount: {fontSize: 18, fontWeight: 'bold', fontFamily: 'Kufam-SemiBoldItalic'},
});

export default FriendsBalanceScreen;
