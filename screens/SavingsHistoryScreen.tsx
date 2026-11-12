import React, {useMemo, useState} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {Card, Text} from 'react-native-paper';
import CircleMinus from 'lucide-react-native/icons/circle-minus';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import History from 'lucide-react-native/icons/history';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash-2';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {useCurrency} from '../utils/CurrencyUtil';
import {useTheme, useThemedStyles, type ThemeColors} from '../src/theme';
import {ErrorState, LoadingState} from '../src/components/ScreenState';
import {useSavingsHistory, useUserData} from '../src/data/hooks';
import type {SavingsHistoryDocument} from '../src/types';

type HistoryItem = SavingsHistoryDocument;
type HistoryType = HistoryItem['type'];

// A stable empty list, so the memos below do not recompute while nothing has loaded.
const NO_HISTORY: HistoryItem[] = [];

interface GoalRef {
  id: string;
  name: string;
}

const SavingsHistoryScreen = () => {
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const {formatAmount} = useCurrency();
  // The history is read again each time the screen opens (the saved copy shows meanwhile); the
  // goal names for the filter come from the shared profile cache.
  const historyQuery = useSavingsHistory();
  const user = useUserData();
  const allHistory = historyQuery.data ?? NO_HISTORY;
  const goals: GoalRef[] = useMemo(
    () => (user.data?.savingsGoals ?? []).map(g => ({id: g.id, name: g.name})),
    [user.data],
  );
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const history = useMemo(
    () =>
      selectedGoalId === null
        ? allHistory
        : allHistory.filter(item => item.goalId === selectedGoalId),
    [selectedGoalId, allHistory],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await historyQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderIcon = (type: HistoryType) => {
    switch (type) {
      case 'deposit':
        return <CirclePlus size={20} color={colors.income} />;
      case 'withdrawal':
        return <CircleMinus size={20} color={colors.expense} />;
      case 'create':
        return <Plus size={20} color={colors.primary} />;
      case 'delete':
        return <Trash2 size={20} color={colors.expense} />;
      default:
        return <Pencil size={20} color={colors.primary} />;
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
        {historyQuery.loading ? (
          <LoadingState message="Loading activity..." />
        ) : historyQuery.error ? (
          // A failed load must not read as "no savings activity": show the error state instead.
          <ErrorState
            title="Could not load savings activity"
            onRetry={() => historyQuery.refetch()}
          />
        ) : (
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
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterScrollContent}>
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
                    <History size={48} color={colors.iconMuted} />
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
    filterScroll: {marginBottom: 15},
    filterScrollContent: {flexDirection: 'row'},
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
