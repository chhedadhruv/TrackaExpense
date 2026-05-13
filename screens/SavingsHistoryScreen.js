import React, {useEffect, useState, useCallback} from 'react';
import {View, StyleSheet, Platform, RefreshControl, ScrollView, TouchableOpacity} from 'react-native';
import {Card, ActivityIndicator, Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useCurrency} from '../utils/CurrencyUtil';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';

const SavingsHistoryScreen = () => {
  const {formatAmount} = useCurrency();
  const [loading, setLoading] = useState(true);
  const [allHistory, setAllHistory] = useState([]);
  const [history, setHistory] = useState([]);
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
      const savedGoals = (userDoc.data()?.savingsGoals || []).map(g => ({id: g.id, name: g.name}));
      setGoals(savedGoals);

      const snapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('savingsHistory')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          goalName: data.goalName || data.goal?.name || 'savings goal',
        };
      });
      setAllHistory(items);
      setHistory(items);
    } catch (e) {
      setAllHistory([]);
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedGoalId === null) {
      setHistory(allHistory);
    } else {
      setHistory(allHistory.filter(item => item.goalId === selectedGoalId));
    }
  }, [selectedGoalId, allHistory]);

  const renderIcon = type => {
    switch (type) {
      case 'deposit':
        return <MaterialCommunityIcons name="plus-circle" size={20} color={SUCCESS_COLOR} />;
      case 'withdrawal':
        return <MaterialCommunityIcons name="minus-circle" size={20} color={EXPENSE_COLOR} />;
      case 'create':
        return <MaterialCommunityIcons name="plus" size={20} color={PRIMARY_COLOR} />;
      case 'delete':
        return <MaterialCommunityIcons name="delete" size={20} color={EXPENSE_COLOR} />;
      default:
        return <MaterialCommunityIcons name="pencil" size={20} color={PRIMARY_COLOR} />;
    }
  };

  const renderDescription = item => {
    const goalName = item.goalName || 'savings goal';
    switch (item.type) {
      case 'deposit':
        return `Added to ${goalName}`;
      case 'withdrawal':
        return `Withdrawn from ${goalName}`;
      case 'create':
        return `Created goal: ${goalName}`;
      case 'delete':
        return `Deleted goal: ${goalName}`;
      case 'update':
        return `Updated ${goalName}`;
      default:
        return 'Savings activity';
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading activity...</Text>
          </View>
        ) : (
          <KeyboardAwareScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                colors={[PRIMARY_COLOR]}
                tintColor={PRIMARY_COLOR}
              />
            }>
            <Card
              style={[styles.historyCard, Platform.OS === 'android' && styles.cardAndroid]}
              elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.cardContent}>
                <Text style={styles.historyTitle}>Savings Activity</Text>
                {goals.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{marginBottom: 15}}
                    contentContainerStyle={{flexDirection: 'row'}}>
                    <TouchableOpacity
                      onPress={() => setSelectedGoalId(null)}
                      style={[styles.filterChip, selectedGoalId === null && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, selectedGoalId === null && styles.filterChipTextActive]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {goals.map(g => (
                      <TouchableOpacity
                        key={g.id}
                        onPress={() => setSelectedGoalId(g.id)}
                        style={[styles.filterChip, selectedGoalId === g.id && styles.filterChipActive]}>
                        <Text style={[styles.filterChipText, selectedGoalId === g.id && styles.filterChipTextActive]}>
                          {g.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {history.length > 0 ? (
                  history.map(item => (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyIcon}>{renderIcon(item.type)}</View>
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDescription}>{renderDescription(item)}</Text>
                        {item.amount ? (
                          <Text
                            style={[
                              styles.historyAmount,
                              item.type === 'deposit' ? styles.positiveAmount : styles.negativeAmount,
                            ]}>
                            {item.type === 'deposit' ? '+' : '-'}
                            {formatAmount(item.amount)}
                          </Text>
                        ) : null}
                        <Text style={styles.historyDate}>
                          {item.createdAt ? item.createdAt.toDate().toLocaleString() : 'Unknown date'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyHistory}>
                    <MaterialCommunityIcons name="history" size={48} color="#CBD3EE" />
                    <Text style={styles.emptyHistoryText}>No activity yet</Text>
                    <Text style={styles.emptyHistorySubtext}>
                      Your savings activity will appear here
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </KeyboardAwareScrollView>
        )}
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingText: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginTop: 15,
    fontFamily: 'Lato-Regular',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
  },
  cardContent: {
    padding: 25,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 20,
    fontFamily: 'Lato-Bold',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyIcon: {
    width: 40,
    alignItems: 'center',
  },
  historyDetails: {
    flex: 1,
    marginLeft: 10,
  },
  historyDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  historyAmount: {
    fontSize: 13,
    fontFamily: 'Lato-Bold',
    marginTop: 2,
  },
  positiveAmount: {
    color: SUCCESS_COLOR,
  },
  negativeAmount: {
    color: EXPENSE_COLOR,
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
    fontFamily: 'Lato-Bold',
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  cardAndroid: {
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#EEF0FB',
  },
  filterChipActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterChipText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Regular',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
  },
});

export default SavingsHistoryScreen;
