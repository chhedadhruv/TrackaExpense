import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {Card, Searchbar, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const INCOME_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';

const AddOrRemoveExpense = ({navigation}) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState([]);

  const handleSearch = text => {
    setSearchQuery(text);
    if (!userData?.transactions) return;
    
    if (!text.trim()) {
      setFilteredTransactions([]);
      return;
    }
    
    const filteredTransactions = userData.transactions.filter(transaction =>
      transaction.title.toLowerCase().includes(text.toLowerCase()) ||
      transaction.category?.toLowerCase().includes(text.toLowerCase()) ||
      transaction.amount.toString().includes(text)
    );
    setFilteredTransactions(filteredTransactions);
  };

  const currentUserUid = auth().currentUser.uid;

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const transactionsQuerySnapshot = await firestore()
        .collection('users')
        .doc(currentUserUid)
        .collection('transactions')
        .orderBy('createdAt', 'desc')
        .get();

      if (transactionsQuerySnapshot.empty) {
        setUserData({transactions: []});
        setLoading(false);
        return;
      }

      const transactions = [];

      transactionsQuerySnapshot.forEach(transactionDoc => {
        const transactionData = transactionDoc.data();
        const transactionId = transactionDoc.id;

        const transaction = {
          id: transactionId,
          ...transactionData,
        };

        transactions.push(transaction);
      });

      setUserData({transactions});
      setLoading(false);

      if (searchQuery !== '') {
        const filteredTransactions = transactions.filter(transaction =>
          transaction.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.amount.toString().includes(searchQuery)
        );
        setFilteredTransactions(filteredTransactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Alert.alert(
        'Error',
        'Failed to load transactions. Please try again later.',
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, []),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTransactions();
    });

    return unsubscribe;
  });

  const toggleShowAll = () => {
    setShowAll(!showAll);
  };

  const getCategoryIcon = (category, type) => {
    const iconMap = {
      Bills: 'receipt',
      Education: 'school',
      Entertainment: 'movie',
      Food: 'food',
      Health: 'hospital',
      Shopping: 'cart',
      Travel: 'bus',
      Salary: 'cash',
      Bonus: 'cash',
      Gift: 'cash',
      Others: type === 'income' ? 'cash' : 'cash-remove',
    };

    return iconMap[category] || (type === 'income' ? 'cash' : 'cash-remove');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  const displayTransactions = searchQuery !== '' ? filteredTransactions : userData?.transactions || [];
  const sortedTransactions = displayTransactions
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, showAll ? displayTransactions.length : 5);

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Manage Transactions</Text>
        <Text style={styles.headerSubtitle}>
          Add income or expenses to track your finances
        </Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search by title, amount, or category..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={PRIMARY_COLOR}
          />
        </View>

        {/* Recent Transactions Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Text style={styles.sectionSubtitle}>
              {displayTransactions.length} transaction{displayTransactions.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          {displayTransactions.length > 5 && (
            <TouchableOpacity onPress={toggleShowAll} style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>
                {showAll ? 'Show Less' : 'Show All'}
              </Text>
              <MaterialCommunityIcons
                name={showAll ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Transactions List */}
        <View style={styles.transactionsList}>
          {sortedTransactions.length > 0 ? (
            sortedTransactions.map((transaction, index) => (
              <Card
                style={styles.transactionsCard}
                key={transaction.id || index}
                onPress={() =>
                  navigation.navigate('TransactionDetail', {
                    transaction,
                  })
                }>
                <View style={styles.transactionsCardContent}>
                  <View style={styles.transactionsCardDetails}>
                    <View style={styles.transactionsCardIcon}>
                      <MaterialCommunityIcons
                        name={getCategoryIcon(transaction.category, transaction.type)}
                        size={24}
                        color={PRIMARY_COLOR}
                      />
                    </View>
                    <View style={styles.transactionsCardInfo}>
                      <Text style={styles.transactionsCardTitle} numberOfLines={1}>
                        {transaction.title.length > 30
                          ? transaction.title.slice(0, 30) + '...'
                          : transaction.title}
                      </Text>
                      <View style={styles.transactionsCardMeta}>
                        <Text style={styles.transactionsCardDate}>
                          {transaction.date}
                        </Text>
                        {transaction.time && (
                          <Text style={styles.transactionsCardTime}>
                            {transaction.time}
                          </Text>
                        )}
                      </View>
                      {transaction.category && (
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryText}>
                            {transaction.category}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.transactionsCardAmount}>
                    <Text
                      style={
                        transaction.type === 'income'
                          ? styles.transactionsCardAmountIncomeText
                          : styles.transactionsCardAmountExpenseText
                      }>
                      {transaction.type === 'income' ? '+ ₹' : '- ₹'}
                      {parseInt(transaction.amount, 10).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons 
                name={searchQuery ? "magnify" : "receipt-text-outline"} 
                size={64} 
                color="#CBD3EE" 
              />
              <Text style={styles.emptyStateTitle}>
                {searchQuery ? 'No transactions found' : 'No transactions yet'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms' 
                  : 'Add your first transaction to get started'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.incomeButton]}
          onPress={() => navigation.navigate('AddIncome')}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Add Income</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.expenseButton]}
          onPress={() => navigation.navigate('AddExpense')}>
          <MaterialCommunityIcons name="minus" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Add Expense</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AddOrRemoveExpense;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
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
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  scrollContainer: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderRadius: 12,
  },
  searchInput: {
    fontFamily: 'Lato-Regular',
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(103, 124, 210, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginRight: 4,
    fontFamily: 'Lato-Bold',
  },
  transactionsList: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  transactionsCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  transactionsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  transactionsCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionsCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  transactionsCardInfo: {
    flex: 1,
  },
  transactionsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
    marginBottom: 4,
  },
  transactionsCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  transactionsCardDate: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Lato-Regular',
  },
  transactionsCardTime: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
    fontFamily: 'Lato-Regular',
  },
  categoryTag: {
    backgroundColor: PRIMARY_COLOR + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
    fontFamily: 'Lato-Regular',
  },
  transactionsCardAmount: {
    alignItems: 'flex-end',
  },
  transactionsCardAmountIncomeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: INCOME_COLOR,
    fontFamily: 'Lato-Bold',
  },
  transactionsCardAmountExpenseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: EXPENSE_COLOR,
    fontFamily: 'Lato-Bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
    fontFamily: 'Lato-Bold',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Lato-Regular',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '47%',
    height: 50,
    borderRadius: 16,
    elevation: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  incomeButton: {
    backgroundColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
  },
  expenseButton: {
    backgroundColor: EXPENSE_COLOR,
    shadowColor: EXPENSE_COLOR,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
});
