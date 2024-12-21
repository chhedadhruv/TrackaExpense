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
import {Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

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
        <ActivityIndicator size="large" color="#677CD2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.myCard}>
        <View style={styles.cardContentWithIcon}>
          <View style={styles.Icon}>
            <MaterialCommunityIcons name="wallet" color="#fff" size={24} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>{transaction.title}</Text>
            <Text style={styles.BalanceText}>
              ₹{parseInt(transaction.amount).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.dataCard}>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Date</Text>
            <Text style={styles.ValueText}>{transaction.date}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Category</Text>
            <Text style={styles.ValueText}>{transaction.category}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Type</Text>
            <Text style={styles.ValueText}>
              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
            </Text>
          </View>
        </View>

        {transaction.description && (
          <View style={[styles.dataCard, {marginTop: 10}]}>
            <View style={styles.cardContent}>
              <Text style={styles.TitleText}>Description</Text>
              <Text style={styles.ValueText}>{transaction.description}</Text>
            </View>
          </View>
        )}
      </View>

      {transaction.imageUrl && (
        <TouchableOpacity onPress={onImagePress}>
          <View style={styles.transactionsCard}>
            <Image
              source={{uri: transaction.imageUrl}}
              style={styles.transactionsCardImage}
            />
            <View style={styles.transactionsCardContent}>
              <Text style={styles.transactionsCardTitle}>Receipt Image</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#959698" />
            </View>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleEdit}>
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  myCard: {
    margin: 5,
    padding: 20,
    backgroundColor: '#677CD2',
    borderRadius: 12,
  },
  dataCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  cardContentWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  Icon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#7A8EE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  TitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CED6EC',
    marginBottom: 5,
  },
  BalanceText: {
    fontSize: 26,
    fontWeight: '500',
    color: '#fff',
  },
  ValueText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
  transactionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  transactionsCardImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  transactionsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    marginLeft: 10,
  },
  transactionsCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  button: {
    width: '48%',
    height: 45,
    borderRadius: 24,
    backgroundColor: '#677CD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  deleteButton: {
    width: '48%',
    height: 45,
    borderRadius: 24,
    backgroundColor: '#F64E4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#F64E4E',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default TransactionDetailScreen;