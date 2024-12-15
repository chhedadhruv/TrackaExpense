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
import {Card, Title, Paragraph, Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

const TransactionDetailScreen = ({route, navigation}) => {
  const {transaction} = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onCardPress = () => {
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
      // Delete the transaction from Firestore
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .doc(id)
        .delete();
      console.log('Transaction deleted from Firestore!');

      // Update the balance in the user document
      const balanceIncrement = type === 'expense' ? +amount : -amount;
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          balance: firestore.FieldValue.increment(balanceIncrement),
        });
      console.log('Balance updated in Firestore!');
      Alert.alert('Transaction deleted successfully!');
      navigation.goBack();

      // If the transaction has an imageUrl, delete the image from Firebase Storage
      if (imageUrl) {
        const imageRef = storage().refFromURL(imageUrl);
        await imageRef.delete();
        console.log('Image deleted from Firebase Storage!');
      }
    } catch (error) {
      console.error('Error deleting transaction or image: ', error);
      setError('An error occurred while deleting the transaction.');
      Alert.alert('Error', 'An error occurred while deleting the transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <>
            <Card style={styles.card}>
              <Card.Content>
                <Title>{transaction.title}</Title>
                <Paragraph>{transaction.description}</Paragraph>
                <View style={styles.amountContainer}>
                  <Title style={styles.amountText}>
                    ₹{parseInt(transaction.amount).toLocaleString()}
                  </Title>
                </View>
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.infoContainer}>
                  <MaterialCommunityIcons
                    name="calendar"
                    color="#333"
                    size={20}
                  />
                  <Paragraph style={styles.infoText}>
                    {transaction.date}
                  </Paragraph>
                </View>
                <View style={styles.infoContainer}>
                  <MaterialCommunityIcons name="tag" color="#333" size={20} />
                  <Paragraph style={styles.infoText}>
                    {transaction.category}
                  </Paragraph>
                </View>
                <View style={styles.infoContainer}>
                  <MaterialCommunityIcons
                    name="account"
                    color="#333"
                    size={20}
                  />
                  <Paragraph style={styles.infoText}>
                    {transaction.type.charAt(0).toUpperCase() +
                      transaction.type.slice(1)}
                  </Paragraph>
                </View>
              </Card.Content>
            </Card>

            {transaction.imageUrl && (
              <TouchableOpacity onPress={onCardPress}>
                <Card style={styles.card}>
                  <Card.Content>
                    <Image
                      source={{uri: transaction.imageUrl}}
                      style={{width: '100%', height: 300}}
                    />
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            )}

            {/* Buttons for edit and delete */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={handleEdit}>
                <Text style={styles.buttonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}>
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Display error message if any */}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  card: {
    marginHorizontal: 10,
    marginVertical: 5,
    elevation: 2,
  },
  amountContainer: {
    justifyContent: 'center',
    marginVertical: 10,
  },
  amountText: {
    fontSize: 30,
    fontFamily: 'Kufam-SemiBoldItalic',
    color: '#333',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  infoText: {
    fontSize: 16,
    fontFamily: 'Lato-Regular',
    color: '#333',
    marginLeft: 10,
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
    backgroundColor: '#B71C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'red',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default TransactionDetailScreen;
