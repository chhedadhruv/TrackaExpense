import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {Text, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

const TransactionDetailScreen = ({route, navigation}) => {
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

  const handleDelete = async () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: deleteTransaction,
        },
      ],
      {cancelable: false},
    );
  };

  const deleteTransaction = async () => {
    setLoading(true);
    setError('');
    const {userId, id, imageUrl, amount, type} = transaction;

    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .doc(id)
        .delete();

      const balanceIncrement = type === 'expense' ? +amount : -amount;
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          balance: firestore.FieldValue.increment(balanceIncrement),
        });

      if (imageUrl) {
        const imageRef = storage().refFromURL(imageUrl);
        await imageRef.delete();
      }

      Alert.alert('Transaction deleted successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting transaction or image: ', error);
      setError('An error occurred while deleting the transaction.');
      Alert.alert('Error', 'An error occurred while deleting the transaction.');
    } finally {
      setLoading(false);
    }
  };

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
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerContent}>
          <View style={styles.transactionTypeIcon}>
            <MaterialCommunityIcons
              name={transaction.type === 'income' ? 'trending-up' : 'trending-down'}
              size={24}
              color={transaction.type === 'income' ? '#25B07F' : '#F64E4E'}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{transaction.title}</Text>
            <Text style={styles.headerAmount}>
              {transaction.type === 'income' ? '+ ' : '- '}₹{parseInt(transaction.amount).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Transaction Details Card */}
        <Card style={styles.detailsCard}>
          <View style={styles.detailsCardContent}>
            <Text style={styles.sectionTitle}>Transaction Details</Text>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <MaterialCommunityIcons name="calendar" size={20} color={PRIMARY_COLOR} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{transaction.date}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <MaterialCommunityIcons name="tag" size={20} color={PRIMARY_COLOR} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{transaction.category}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <MaterialCommunityIcons 
                  name={transaction.type === 'income' ? 'plus-circle' : 'minus-circle'} 
                  size={20} 
                  color={PRIMARY_COLOR} 
                />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Type</Text>
                <View style={[styles.typeTag, {backgroundColor: transaction.type === 'income' ? '#E8F5E8' : '#FFEBEE'}]}>
                  <Text style={[styles.typeText, {color: transaction.type === 'income' ? '#25B07F' : '#F64E4E'}]}>
                    {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {transaction.description && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <MaterialCommunityIcons name="text" size={20} color={PRIMARY_COLOR} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{transaction.description}</Text>
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Receipt Image Card */}
        {transaction.imageUrl && (
          <Card style={styles.imageCard}>
            <TouchableOpacity onPress={onImagePress} style={styles.imageCardContent}>
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
        )}

        {/* Action Buttons */}
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

        {error && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#F64E4E" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

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
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  headerSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionTypeIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 6,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  headerAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
  },
  scrollContainer: {
    flex: 1,
  },
  detailsCard: {
    margin: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  detailsCardContent: {
    padding: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 20,
    fontFamily: 'Lato-Bold',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  detailContent: {
    flex: 1,
  },
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
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  imageCard: {
    margin: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  imageCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  imageContainer: {
    marginRight: 15,
  },
  receiptImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  imageInfo: {
    flex: 1,
  },
  imageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 4,
    fontFamily: 'Lato-Bold',
  },
  imageSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 15,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    backgroundColor: '#F64E4E',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#F64E4E',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    borderLeftColor: '#F64E4E',
  },
  errorText: {
    fontSize: 14,
    color: '#F64E4E',
    marginLeft: 10,
    flex: 1,
    fontFamily: 'Lato-Regular',
  },
});

export default TransactionDetailScreen;