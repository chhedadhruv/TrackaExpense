import React, {useState, useEffect, useContext, useCallback} from 'react';
import UserAvatar from 'react-native-user-avatar';
import {AuthContext} from '../navigation/AuthProvider';
import FormButton from '../components/FormButton';
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
  FlatList,
  Image,
} from 'react-native';
import {Avatar, ActivityIndicator, Card, Button, Divider} from 'react-native-paper';
import Icon from 'react-native-vector-icons/FontAwesome5';

const ProfileScreen = ({navigation, route}) => {
  const {logout} = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  const user = auth().currentUser;

  console.log('User', user);

  user.reload();

  const getUser = async () => {
    const currentUser = await firestore()
      .collection('users')
      .doc(user.uid)
      .get()
      .then(documentSnapshot => {
        if (documentSnapshot.exists) {
          setUserData(documentSnapshot.data());
          console.log('User Data', documentSnapshot.data());
          setLoading(false);
        }
      });
  };

  useFocusEffect(
    useCallback(() => {
      getUser();
    }, [route.key]),
  );

  const handleVerify = () => {
    if(user.emailVerified || userData && userData.verified == true) {
      setVerified(true);
    } else {
      setVerified(false);
    }
  };

  useEffect(() => {
    handleVerify();
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}>
        <ActivityIndicator size="large" color="#677CD2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Card style={styles.userCard}>
          <Card.Content style={styles.userCardContent}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
              }}>
              <View style={styles.userCardAvatar}>
                {userData.userImg != null ? (
                  <Avatar.Image source={{uri: userData.userImg}} size={80} />
                ) : (
                  <UserAvatar
                    size={90}
                    bgColor={'#677CD2'}
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
                <Button mode="contained" style={{marginTop: 10}}>
                  {verified ? 'Verified' : 'Not Verified'}
                </Button>
              </View>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('EditProfile')}>
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.btn}>
            <Icon name="receipt" size={20} color="#677CD2" />
            <Text style={styles.btnText}>Split Bill</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" />
            </TouchableOpacity>
            <Divider />
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate('AddExpense')}>
            <Icon name="arrow-up" size={20} color="#677CD2" />
            <Text style={styles.btnText}>My Expenses</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate('AddIncome')}>
            <Icon name="arrow-down" size={20} color="#677CD2" />
            <Text style={styles.btnText}>My Income</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.btn}>
            <Icon name="user-cog" size={20} color="#677CD2" />
            <Text style={styles.btnTextNew}>Account Settings</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.btn}
            onPress={() => logout()}>
            <Icon name="power-off" size={20} color="#677CD2" />
            <Text style={styles.btnText}>Logout</Text>
            <Icon name="angle-right" size={20} color="#8F8F8F" style={{justifyContent: 'flex-end'}} />
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
    // backgroundColor: '#fff',
    flex: 1,
  },
  userCard: {
    // marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 10,
    // elevation: 4,
    backgroundColor: '#fff',
  },
  userCardContent: {
    padding: 20,
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