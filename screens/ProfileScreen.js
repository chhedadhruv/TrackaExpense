import React, {useState, useEffect, useContext, useCallback} from 'react';
import UserAvatar from 'react-native-user-avatar';
import {AuthContext} from '../navigation/AuthProvider';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Linking,
} from 'react-native';
import {
  Avatar,
  ActivityIndicator,
  Card,
  Button,
  Divider,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/FontAwesome5';

const ProfileScreen = ({navigation, route}) => {
  const {logout} = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = auth().currentUser;

  const getUser = async () => {
    try {
      setLoading(true);
      const currentUser = await firestore()
        .collection('users')
        .doc(user.uid)
        .get();

      if (currentUser.exists) {
        setUserData(currentUser.data());
        setLoading(false);
      } else {
        throw new Error('User data not found');
      }
    } catch (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      getUser();
    }, [route.key]),
  );

  const handleVerify = () => {
    if (user.emailVerified || (userData && userData.verified === true)) {
      setVerified(true);
    } else {
      setVerified(false);
    }
  };

  useEffect(() => {
    handleVerify();
  }, [userData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#677CD2" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={getUser}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Card style={styles.userCard}>
          <Card.Content style={styles.userCardContent}>
            <View style={styles.userCardRow}>
              <View style={styles.userCardAvatar}>
                {userData.userImg != null ? (
                  <Avatar.Image source={{uri: userData.userImg}} size={80} />
                ) : (
                  <UserAvatar
                    size={90}
                    bgColor="#677CD2"
                    name={userData ? userData.name : ''}
                  />
                )}
              </View>
              <View style={styles.userCardInfo}>
                <Text style={styles.userCardTitle}>
                  {userData ? userData.name : ''}
                </Text>
                <Text style={styles.userCardCaption}>
                  {userData ? userData.email : ''}
                </Text>
                <Button mode="contained" style={styles.verifiedButton}>
                  {verified ? 'Verified' : 'Not Verified'}
                </Button>
              </View>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                // Assuming you're navigating from a previous screen and passing the user object
                navigation.navigate('EditProfile', {user: userData});
              }}>
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate('Feedback')}>
            <Icon name="comment" size={20} color="#677CD2" />
            <Text style={styles.btnText}>Feedback</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              const url =
                'https://www.termsfeed.com/live/2c961df9-554e-434f-a862-ebf55df1bd49';
              Linking.openURL(url);
            }}>
            <Icon name="shield-alt" size={20} color="#677CD2" />
            <Text style={styles.btnText}>Privacy Policy</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.btn} onPress={() => logout()}>
            <Icon name="power-off" size={20} color="#677CD2" />
            <Text style={styles.btnText}>Logout</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" />
          </TouchableOpacity>
          <Divider />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  userCard: {
    marginHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  userCardContent: {
    padding: 20,
  },
  userCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  userCardAvatar: {
    marginRight: 20,
  },
  userCardInfo: {
    flex: 1,
  },
  userCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1C3D',
  },
  userCardCaption: {
    fontSize: 14,
    fontWeight: '400',
    color: '#444',
  },
  verifiedButton: {
    marginTop: 10,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#677CD2',
    paddingVertical: 10,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
  },
  buttonContainer: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderRadius: 100,
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  btnText: {
    fontSize: 18,
    fontWeight: '400',
    color: '#1A1C3D',
    marginLeft: 20,
    flex: 1,
  },
  btnTextNew: {
    fontSize: 18,
    fontWeight: '400',
    color: '#1A1C3D',
    marginLeft: 15,
    flex: 1,
  },
});
