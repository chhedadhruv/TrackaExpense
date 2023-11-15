import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const TransactionDetailScreen = ({ route, navigation }) => {
  const { transaction } = route.params;

  const onCardPress = () => {
    if (transaction.imageUrl) {
      navigation.navigate('Image', { imageUrl: transaction.imageUrl });
    }
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>{transaction.title}</Title>
          <Paragraph>{transaction.description}</Paragraph>
          <View style={styles.amountContainer}>
            <Title style={styles.amountText}>₹{parseInt(transaction.amount).toLocaleString()}</Title>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.infoContainer}>
            <MaterialCommunityIcons name="calendar" color="#333" size={20} />
            <Paragraph style={styles.infoText}>{transaction.date}</Paragraph>
          </View>
          <View style={styles.infoContainer}>
            <MaterialCommunityIcons name="tag" color="#333" size={20} />
            <Paragraph style={styles.infoText}>{transaction.category}</Paragraph>
          </View>
          <View style={styles.infoContainer}>
            <MaterialCommunityIcons name="account" color="#333" size={20} />
            <Paragraph style={styles.infoText}>{transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}</Paragraph>
          </View>
        </Card.Content>
      </Card>

      {transaction.imageUrl && (
        <TouchableOpacity onPress={onCardPress}>
          <Card style={styles.card}>
            <Card.Content>
              <Image source={{ uri: transaction.imageUrl }} style={{ width: '100%', height: 300 }} />
            </Card.Content>
          </Card>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    card: {
        marginHorizontal: 10,
        marginVertical: 5,
        elevation: 2
    },
    amountContainer: {
        // alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 10
    },
    amountText: {
        fontSize: 30,
        fontFamily: 'Kufam-SemiBoldItalic',
        color: '#333'
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 5
    },
    infoText: {
        fontSize: 16,
        fontFamily: 'Lato-Regular',
        color: '#333',
        marginLeft: 10,
    }

    });

export default TransactionDetailScreen;