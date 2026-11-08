import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {Card, ActivityIndicator, Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useCurrency} from '../../utils/CurrencyUtil';
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  EXPENSE_COLOR,
} from '../../src/constants/theme';

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
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const userEmail = currentUser.email;
      const groupsSnapshot = await getDocs(
        query(
          collection(getFirestore(), 'groups'),
          where('members', 'array-contains', userEmail),
        ),
      );
      const groupIds: Group[] = groupsSnapshot.docs.map(d => ({
        id: d.id,
        name: d.data()?.name,
      }));
      setGroups(groupIds);
      const historySnapshots = await Promise.all(
        groupIds.map(g =>
          getDocs(
            query(
              collection(getFirestore(), 'groups', g.id, 'splitHistory'),
              orderBy('createdAt', 'desc'),
              limit(50),
            ),
          ).then(s =>
            s.docs.map(
              d =>
                ({
                  id: `${g.id}:${d.id}`,
                  groupId: g.id,
                  groupName: g.name,
                  ...d.data(),
                } as HistoryItem),
            ),
          ),
        ),
      );
      const merged = historySnapshots.flat();
      merged.sort((a, b) => {
        const ta =
          a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
        const tb =
          b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
        return tb - ta;
      });
      setAllHistory(merged);
      setHistory(merged);
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
      selectedGroup === null
        ? allHistory
        : allHistory.filter(item => item.groupId === selectedGroup),
    );
  }, [selectedGroup, allHistory]);

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
          <MaterialCommunityIcons name="plus" size={20} color={PRIMARY_COLOR} />
        );
      case 'settlement_create':
        return (
          <MaterialCommunityIcons
            name="bank-transfer"
            size={20}
            color={PRIMARY_COLOR}
          />
        );
      case 'delete':
        return (
          <MaterialCommunityIcons
            name="delete"
            size={20}
            color={EXPENSE_COLOR}
          />
        );
      default:
        return (
          <MaterialCommunityIcons
            name="pencil"
            size={20}
            color={PRIMARY_COLOR}
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
                    style={{marginBottom: 15}}
                    contentContainerStyle={{flexDirection: 'row'}}>
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
                      color="#CBD3EE"
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
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
  cardContent: {padding: 25},
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
  historyIcon: {width: 40, alignItems: 'center'},
  historyDetails: {flex: 1, marginLeft: 10},
  historyDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  historyAmount: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
    marginTop: 2,
  },
  emptyHistory: {alignItems: 'center', paddingVertical: 40},
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
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#EEF0FB',
  },
  filterChipActive: {backgroundColor: PRIMARY_COLOR},
  filterChipText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Regular',
  },
  filterChipTextActive: {color: '#FFFFFF', fontFamily: 'Lato-Bold'},
  changeList: {marginTop: 4},
  changeItem: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Lato-Regular',
    marginTop: 1,
  },
});
