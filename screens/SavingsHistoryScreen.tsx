import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {Card, ActivityIndicator, Text} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {useCurrency} from '../utils/CurrencyUtil';
import {useTheme, useThemedStyles, type ThemeColors} from '../src/theme';

type HistoryType = 'deposit' | 'withdrawal' | 'create' | 'delete' | 'update';

interface HistoryItem {
  id: string;
  type: HistoryType;
  amount?: number;
  goalId?: string;
  goalName?: string;
  createdAt?: any;
}

interface GoalRef {
  id: string;
  name: string;
}

const SavingsHistoryScreen = () => {
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const {formatAmount} = useCurrency();
  const [loading, setLoading] = useState(true);
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [goals, setGoals] = useState<GoalRef[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
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
      const userDoc = await getDoc(
        fsDoc(getFirestore(), 'users', currentUser.uid),
      );
      const savedGoals = ((userDoc.data()?.savingsGoals ?? []) as any[]).map(
        g => ({id: g.id, name: g.name}),
      );
      setGoals(savedGoals);
      const snapshot = await getDocs(
        query(
          collection(
            getFirestore(),
            'users',
            currentUser.uid,
            'savingsHistory',
          ),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      );
      const items: HistoryItem[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          goalName: data.goalName || data.goal?.name || 'savings goal',
        } as HistoryItem;
      });
      setAllHistory(items);
      setHistory(items);
    } catch (_) {
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
    setHistory(
      selectedGoalId === null
        ? allHistory
        : allHistory.filter(item => item.goalId === selectedGoalId),
    );
  }, [selectedGoalId, allHistory]);

  const renderIcon = (type: HistoryType) => {
    switch (type) {
      case 'deposit':
        return (
          <MaterialCommunityIcons
            name="plus-circle"
            size={20}
            color={colors.income}
          />
        );
      case 'withdrawal':
        return (
          <MaterialCommunityIcons
            name="minus-circle"
            size={20}
            color={colors.expense}
          />
        );
      case 'create':
        return (
          <MaterialCommunityIcons
            name="plus"
            size={20}
            color={colors.primary}
          />
        );
      case 'delete':
        return (
          <MaterialCommunityIcons
            name="delete"
            size={20}
            color={colors.expense}
          />
        );
      default:
        return (
          <MaterialCommunityIcons
            name="pencil"
            size={20}
            color={colors.primary}
          />
        );
    }
  };

  const renderDescription = (item: HistoryItem) => {
    const name = item.goalName || 'savings goal';
    switch (item.type) {
      case 'deposit':
        return `Added to ${name}`;
      case 'withdrawal':
        return `Withdrawn from ${name}`;
      case 'create':
        return `Created goal: ${name}`;
      case 'delete':
        return `Deleted goal: ${name}`;
      case 'update':
        return `Updated ${name}`;
      default:
        return 'Savings activity';
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
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
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }>
            <Card
              style={[
                styles.historyCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
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
                      style={[
                        styles.filterChip,
                        selectedGoalId === null && styles.filterChipActive,
                      ]}>
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedGoalId === null &&
                            styles.filterChipTextActive,
                        ]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {goals.map(g => (
                      <TouchableOpacity
                        key={g.id}
                        onPress={() => setSelectedGoalId(g.id)}
                        style={[
                          styles.filterChip,
                          selectedGoalId === g.id && styles.filterChipActive,
                        ]}>
                        <Text
                          style={[
                            styles.filterChipText,
                            selectedGoalId === g.id &&
                              styles.filterChipTextActive,
                          ]}>
                          {g.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {history.length > 0 ? (
                  history.map(item => (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyIcon}>
                        {renderIcon(item.type)}
                      </View>
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDescription}>
                          {renderDescription(item)}
                        </Text>
                        {item.amount ? (
                          <Text
                            style={[
                              styles.historyAmount,
                              item.type === 'deposit'
                                ? styles.positiveAmount
                                : styles.negativeAmount,
                            ]}>
                            {item.type === 'deposit' ? '+' : '-'}
                            {formatAmount(item.amount)}
                          </Text>
                        ) : null}
                        <Text style={styles.historyDate}>
                          {item.createdAt
                            ? item.createdAt.toDate().toLocaleString()
                            : 'Unknown date'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyHistory}>
                    <MaterialCommunityIcons
                      name="history"
                      size={48}
                      color={colors.iconMuted}
                    />
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

export default SavingsHistoryScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      fontSize: 16,
      color: colors.primary,
      marginTop: 15,
      fontFamily: 'Lato-Regular',
    },
    historyCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 40,
    },
    cardContent: {padding: 25},
    historyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 20,
      fontFamily: 'Lato-Bold',
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    historyIcon: {width: 40, alignItems: 'center'},
    historyDetails: {flex: 1, marginLeft: 10},
    historyDescription: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    historyAmount: {fontSize: 13, fontFamily: 'Lato-Bold', marginTop: 2},
    positiveAmount: {color: colors.income},
    negativeAmount: {color: colors.expense},
    historyDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: 'Lato-Regular',
    },
    emptyHistory: {alignItems: 'center', paddingVertical: 40},
    emptyHistoryText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 15,
      marginBottom: 5,
      fontFamily: 'Lato-Bold',
    },
    emptyHistorySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      marginRight: 8,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
    },
    filterChipActive: {backgroundColor: colors.primaryFill},
    filterChipText: {
      fontSize: 13,
      color: colors.primary,
      fontFamily: 'Lato-Regular',
    },
    filterChipTextActive: {color: colors.onPrimary, fontFamily: 'Lato-Bold'},
  });
