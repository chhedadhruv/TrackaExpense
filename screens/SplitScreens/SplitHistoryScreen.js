import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {Card, ActivityIndicator, Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useCurrency} from '../../utils/CurrencyUtil';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const EXPENSE_COLOR = '#F64E4E';

const SplitHistoryScreen = () => {
  const {currency, formatAmount} = useCurrency();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const currentUser = auth().currentUser;
        if (!currentUser) {
          setLoading(false);
          return;
        }
        // Fetch groups user belongs to (by membership email)
        const userEmail = currentUser.email;
        const groupsSnapshot = await firestore()
          .collection('groups')
          .where('members', 'array-contains', userEmail)
          .get();
        const groupIds = groupsSnapshot.docs.map(d => ({ id: d.id, name: d.data()?.name }));
        // Fetch history from all groups in parallel
        const historySnapshots = await Promise.all(
          groupIds.map(g =>
            firestore()
              .collection('groups')
              .doc(g.id)
              .collection('splitHistory')
              .orderBy('createdAt', 'desc')
              .limit(50)
              .get()
              .then(s => s.docs.map(d => ({ id: `${g.id}:${d.id}`, groupId: g.id, groupName: g.name, ...d.data() })))
          )
        );
        const merged = historySnapshots.flat();
        // Sort by createdAt desc
        merged.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
          const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
          return tb - ta;
        });
        setHistory(merged);
      } catch (e) {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const renderIcon = (type) => {
    switch (type) {
      case 'create':
        return <MaterialCommunityIcons name="plus" size={20} color={PRIMARY_COLOR} />;
      case 'settlement_create':
        return <MaterialCommunityIcons name="bank-transfer" size={20} color={PRIMARY_COLOR} />;
      case 'delete':
        return <MaterialCommunityIcons name="delete" size={20} color={EXPENSE_COLOR} />;
      default:
        return <MaterialCommunityIcons name="pencil" size={20} color={PRIMARY_COLOR} />;
    }
  };

  const resolveActor = (item) => {
    const raw = (item.actorName || '').trim();
    if (raw && raw.toLowerCase() !== 'me') return raw;
    if (item.actorEmail) {
      try { return item.actorEmail.split('@')[0]; } catch (_) {}
    }
    if (item.actorUid) {
      // Try to infer from settlement/paidBy if available
      if (item.settlement?.from?.userId === item.actorUid) {
        return item.settlement.from.name || item.settlement.from.email || 'Someone';
      }
      if (item.paidBy?.userId === item.actorUid) {
        return item.paidBy.name || item.paidBy.email || 'Someone';
      }
    }
    if (item.settlement?.from?.name) return item.settlement.from.name;
    if (item.paidBy?.name) return item.paidBy.name;
    return 'Someone';
  };

  const renderDescription = (item) => {
    const actor = resolveActor(item);
    const groupName = item.groupName || 'group';
    const splitTitle = item.splitTitle || item.title || 'split';
    if (item.type === 'create') {
      return `${actor} created split "${splitTitle}" in "${groupName}"`;
    }
    if (item.type === 'settlement_create') {
      const fromName = item.settlement?.from?.name || item.settlement?.from?.email || 'Someone';
      const toName = item.settlement?.to?.name || item.settlement?.to?.email || 'Someone';
      return `${actor} recorded settlement ${formatAmount(item.amount || 0)} from ${fromName} to ${toName} in "${groupName}"`;
    }
    if (item.type === 'delete') {
      return `${actor} deleted split "${splitTitle}" from "${groupName}"`;
    }
    // update
    return `${actor} updated split "${splitTitle}" in "${groupName}"`;
  };

  const renderChanges = (item) => {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    if (item.type !== 'update' || changes.length === 0) return null;
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

  const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') {
      // date or paidBy
      if (val.toDate) {
        try { return val.toDate().toLocaleString(); } catch (_) {}
      }
      if (val.email || val.name) {
        return val.name || val.email;
      }
      return JSON.stringify(val);
    }
    if (typeof val === 'number') return `${val}`;
    return String(val);
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
          <KeyboardAwareScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <Card style={styles.historyCard} elevation={2}>
              <View style={styles.cardContent}>
                <Text style={styles.historyTitle}>Split History</Text>
                {history.length > 0 ? (
                  history.map(item => (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyIcon}>{renderIcon(item.type)}</View>
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDescription}>{renderDescription(item)}</Text>
                        {renderChanges(item)}
                        <Text style={styles.historyDate}>
                          {item.createdAt ? item.createdAt.toDate().toLocaleString() : 'Unknown date'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyHistory}>
                    <MaterialCommunityIcons name="history" size={48} color="#CBD3EE" />
                    <Text style={styles.emptyHistoryText}>No split history yet</Text>
                    <Text style={styles.emptyHistorySubtext}>Your split history will appear here</Text>
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
});

export default SplitHistoryScreen;


