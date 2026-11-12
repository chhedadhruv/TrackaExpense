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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import {useCurrency} from '../../utils/CurrencyUtil';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {ErrorState, LoadingState} from '../../src/components/ScreenState';
import {useGroups, useSplitHistory} from '../../src/data/split';

interface HistoryItem {
  id: string;
  groupId: string;
  groupName?: string;
  type: 'create' | 'settlement_create' | 'delete' | 'update' | string;
  splitTitle?: string;
  title?: string;
  amount?: number;
  actorName?: string;
  actorEmail?: string;
  actorUid?: string;
  settlement?: {
    from?: {userId?: string; name?: string; email?: string};
    to?: {name?: string; email?: string};
  };
  paidBy?: {userId?: string; name?: string; email?: string};
  changes?: {field: string; before: unknown; after: unknown}[];
  createdAt?: {toMillis?: () => number; seconds?: number; toDate: () => Date};
}

interface Group {
  id: string;
  name: string;
}

const SplitHistoryScreen = () => {
  const {formatAmount} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const groupsResult = useGroups();
  const groups: Group[] = useMemo(
    () => (groupsResult.data ?? []).map(g => ({id: g.id, name: g.name ?? ''})),
    [groupsResult.data],
  );
  // History is read again every time the screen opens and on pull to refresh; the saved copy
  // shows at once. It waits for the group list so it never runs for an empty list.
  const historyResult = useSplitHistory<HistoryItem>(
    groups,
    groupsResult.data !== undefined,
  );
  const allHistory = historyResult.data;
  const loading = groupsResult.loading || historyResult.loading;
  // A failed load must not read as "No split history yet": show the error state instead.
  const failed = groupsResult.error || historyResult.error;
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const history = useMemo(
    () =>
      selectedGroup === null
        ? allHistory ?? []
        : (allHistory ?? []).filter(item => item.groupId === selectedGroup),
    [selectedGroup, allHistory],
  );

  const load = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    try {
      groupsResult.retry();
      await historyResult.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) {
      return '—';
    }
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (typeof obj.toDate === 'function') {
        try {
          return (obj.toDate as () => Date)().toLocaleString();
        } catch (_) {}
      }
      if (obj.email || obj.name) {
        return String(obj.name || obj.email);
      }
      return JSON.stringify(val);
    }
    if (typeof val === 'number') {
      return String(val);
    }
    return String(val);
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'create':
        return (
          <MaterialCommunityIcons
            name="plus"
            size={20}
            color={colors.primary}
          />
        );
      case 'settlement_create':
        return (
          <MaterialCommunityIcons
            name="bank-transfer"
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

  const resolveActor = (item: HistoryItem): string => {
    const raw = (item.actorName || '').trim();
    if (raw && raw.toLowerCase() !== 'me') {
      return raw;
    }
    if (item.actorEmail) {
      try {
        return item.actorEmail.split('@')[0];
      } catch (_) {}
    }
    if (item.actorUid) {
      if (item.settlement?.from?.userId === item.actorUid) {
        return (
          item.settlement.from?.name || item.settlement.from?.email || 'Someone'
        );
      }
      if (item.paidBy?.userId === item.actorUid) {
        return item.paidBy?.name || item.paidBy?.email || 'Someone';
      }
    }
    if (item.settlement?.from?.name) {
      return item.settlement.from.name;
    }
    if (item.paidBy?.name) {
      return item.paidBy.name;
    }
    return 'Someone';
  };

  const renderDescription = (item: HistoryItem): string => {
    const actor = resolveActor(item);
    const groupName = item.groupName || 'group';
    const splitTitle = item.splitTitle || item.title || 'split';
    if (item.type === 'create') {
      return `${actor} created split "${splitTitle}" in "${groupName}"`;
    }
    if (item.type === 'settlement_create') {
      const fromName =
        item.settlement?.from?.name ||
        item.settlement?.from?.email ||
        'Someone';
      const toName =
        item.settlement?.to?.name || item.settlement?.to?.email || 'Someone';
      return `${actor} recorded settlement ${formatAmount(
        item.amount || 0,
      )} from ${fromName} to ${toName} in "${groupName}"`;
    }
    if (item.type === 'delete') {
      return `${actor} deleted split "${splitTitle}" from "${groupName}"`;
    }
    return `${actor} updated split "${splitTitle}" in "${groupName}"`;
  };

  const renderChanges = (item: HistoryItem) => {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    if (item.type !== 'update' || changes.length === 0) {
      return null;
    }
    return (
      <View style={styles.changeList}>
        {changes.map((c, idx) => (
          <Text key={idx} style={styles.changeItem}>
            {`${c.field}: ${formatValue(c.before)} → ${formatValue(c.after)}`}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {loading ? (
          <LoadingState message="Loading activity..." />
        ) : failed ? (
          <ErrorState
            title="Could not load split history"
            onRetry={() => load()}
          />
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
                <Text style={styles.historyTitle}>Split History</Text>
                {groups.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterScrollContent}>
                    <TouchableOpacity
                      onPress={() => setSelectedGroup(null)}
                      style={[
                        styles.filterChip,
                        selectedGroup === null && styles.filterChipActive,
                      ]}>
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedGroup === null && styles.filterChipTextActive,
                        ]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {groups.map(g => (
                      <TouchableOpacity
                        key={g.id}
                        onPress={() => setSelectedGroup(g.id)}
                        style={[
                          styles.filterChip,
                          selectedGroup === g.id && styles.filterChipActive,
                        ]}>
                        <Text
                          style={[
                            styles.filterChipText,
                            selectedGroup === g.id &&
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
                        {(item.type === 'create' ||
                          item.type === 'settlement_create') &&
                        item.amount ? (
                          <Text style={styles.historyAmount}>
                            {formatAmount(item.amount)}
                          </Text>
                        ) : null}
                        {renderChanges(item)}
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
                    <Text style={styles.emptyHistoryText}>
                      No split history yet
                    </Text>
                    <Text style={styles.emptyHistorySubtext}>
                      Your split history will appear here
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

export default SplitHistoryScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
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
    historyDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: 'Lato-Regular',
    },
    historyAmount: {
      fontSize: 13,
      color: colors.primary,
      fontFamily: 'Lato-Bold',
      marginTop: 2,
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
    filterScroll: {marginBottom: 15},
    filterScrollContent: {flexDirection: 'row'},
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
    changeList: {marginTop: 4},
    changeItem: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'Lato-Regular',
      marginTop: 1,
    },
  });
