import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {Card, ActivityIndicator, Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const EXPENSE_COLOR = '#F64E4E';

const SplitHistoryScreen = () => {
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
        const snapshot = await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .collection('splitHistory')
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistory(items);
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
      case 'delete':
        return <MaterialCommunityIcons name="delete" size={20} color={EXPENSE_COLOR} />;
      default:
        return <MaterialCommunityIcons name="pencil" size={20} color={PRIMARY_COLOR} />;
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
          <KeyboardAwareScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <Card style={styles.historyCard}>
              <View style={styles.cardContent}>
                <Text style={styles.historyTitle}>Split History</Text>
                {history.length > 0 ? (
                  history.map(item => (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyIcon}>{renderIcon(item.type)}</View>
                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDescription}>
                          {item.type === 'create'
                            ? `Created group: ${item.groupName || 'group'}`
                            : item.type === 'delete'
                            ? `Deleted group: ${item.groupName || 'group'}`
                            : `Updated ${item.groupName || 'group'}`}
                        </Text>
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
    elevation: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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


