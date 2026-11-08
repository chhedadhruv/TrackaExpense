import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {Text, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  deleteDoc,
  doc,
  getFirestore,
  increment,
  updateDoc,
} from '@react-native-firebase/firestore';
import {
  deleteObject,
  getStorage,
  refFromURL,
} from '@react-native-firebase/storage';
import {reportError} from '../src/services/ErrorReporter';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {useCurrency} from '../utils/CurrencyUtil';
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  EXPENSE_COLOR,
  INCOME_COLOR,
} from '../src/constants/theme';

const TransactionDetailScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const {formatAmount} = useCurrency();
  const {transaction} = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onImagePress = () => {
    if (transaction.imageUrl) {
      navigation.navigate('Image', {imageUrl: transaction.imageUrl});
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditTransaction', {transaction});
  };

  const deleteTransaction = async () => {
    setLoading(true);
    setError('');
    const {userId, id, imageUrl, amount, type} = transaction;
    const balanceIncrement = type === 'expense' ? +amount : -amount;
    try {
      await deleteDoc(doc(getFirestore(), 'users', userId, 'transactions', id));
      await updateDoc(doc(getFirestore(), 'users', userId), {
        balance: increment(balanceIncrement),
      });
      if (imageUrl) {
        const imageRef = refFromURL(getStorage(), imageUrl);
        await deleteObject(imageRef);
      }
      AnalyticsService.logDeleteTransaction({
        type: transaction.type,
        category: transaction.category,
      });
      Alert.alert('Transaction deleted successfully!');
      navigation.goBack();
    } catch (e) {
      reportError(e as Error);
      setError('An error occurred while deleting the transaction.');
      Alert.alert('Error', 'An error occurred while deleting the transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', onPress: deleteTransaction},
      ],
      {cancelable: false},
    );
  };

  const accentColor =
    transaction.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Deleting transaction...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.headerContent}>
          <View style={styles.transactionTypeIcon}>
            <MaterialCommunityIcons
              name={
                transaction.type === 'income' ? 'trending-up' : 'trending-down'
              }
              size={24}
              color={accentColor}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{transaction.title}</Text>
            <Text style={[styles.headerAmount, {color: accentColor}]}>
              {transaction.type === 'income' ? '+ ' : '- '}
              {formatAmount(transaction.amount)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        <Card
          style={[
            styles.detailsCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 2}>
          <View style={styles.detailsCardContent}>
            <Text style={styles.sectionTitle}>Transaction Details</Text>

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color={PRIMARY_COLOR}
                />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{transaction.date}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <MaterialCommunityIcons
                  name="tag"
                  size={20}
                  color={PRIMARY_COLOR}
                />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{transaction.category}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <MaterialCommunityIcons
                  name={
                    transaction.type === 'income'
                      ? 'plus-circle'
                      : 'minus-circle'
                  }
                  size={20}
                  color={PRIMARY_COLOR}
                />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Type</Text>
                <View
                  style={[
                    styles.typeTag,
                    {
                      backgroundColor:
                        transaction.type === 'income' ? '#E8F5E8' : '#FFEBEE',
                    },
                  ]}>
                  <Text style={[styles.typeText, {color: accentColor}]}>
                    {transaction.type.charAt(0).toUpperCase() +
                      transaction.type.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {transaction.description ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <MaterialCommunityIcons
                    name="text"
                    size={20}
                    color={PRIMARY_COLOR}
                  />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>
                    {transaction.description}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </Card>

        {transaction.imageUrl ? (
          <Card
            style={[
              styles.imageCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <TouchableOpacity
              onPress={onImagePress}
              style={styles.imageCardContent}>
              <View style={styles.imageContainer}>
                <Image
                  source={{uri: transaction.imageUrl}}
                  style={styles.receiptImage}
                />
              </View>
              <View style={styles.imageInfo}>
                <Text style={styles.imageTitle}>Receipt Image</Text>
                <Text style={styles.imageSubtitle}>Tap to view full size</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </Card>
        ) : null}

        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <MaterialCommunityIcons name="delete" size={20} color="#FFFFFF" />
            <Text style={styles.deleteButtonText}>Delete Transaction</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={EXPENSE_COLOR}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default TransactionDetailScreen;

const styles = StyleSheet.create({
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
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  headerSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerContent: {flexDirection: 'row', alignItems: 'center'},
  transactionTypeIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  headerInfo: {flex: 1},
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 6,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  headerAmount: {fontSize: 28, fontWeight: 'bold', fontFamily: 'Lato-Bold'},
  scrollContainer: {flex: 1},
  detailsCard: {backgroundColor: '#FFFFFF', margin: 20, borderRadius: 16},
  detailsCardContent: {padding: 25},
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 20,
    fontFamily: 'Lato-Bold',
  },
  detailRow: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20},
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  detailContent: {flex: 1},
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
    fontFamily: 'Lato-Regular',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  typeTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  typeText: {fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold'},
  imageCard: {margin: 20, borderRadius: 16},
  imageCardContent: {flexDirection: 'row', alignItems: 'center', padding: 20},
  imageContainer: {marginRight: 15},
  receiptImage: {width: 60, height: 60, borderRadius: 12},
  imageInfo: {flex: 1},
  imageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 4,
    fontFamily: 'Lato-Bold',
  },
  imageSubtitle: {fontSize: 14, color: '#666', fontFamily: 'Lato-Regular'},
  actionSection: {paddingHorizontal: 20, paddingBottom: 30, gap: 15},
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 4,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EXPENSE_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 4,
    shadowColor: EXPENSE_COLOR,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: EXPENSE_COLOR,
  },
  errorText: {
    fontSize: 14,
    color: EXPENSE_COLOR,
    marginLeft: 10,
    flex: 1,
    fontFamily: 'Lato-Regular',
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
