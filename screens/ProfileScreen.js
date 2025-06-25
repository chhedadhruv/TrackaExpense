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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

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
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F64E4E" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={getUser}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerText}>Profile</Text>
          <Text style={styles.subHeaderText}>Manage your account settings</Text>
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileCardContent}>
            <View style={styles.profileRow}>
              <View style={styles.avatarSection}>
                {userData?.userImg != null ? (
                  <Avatar.Image source={{uri: userData.userImg}} size={80} />
                ) : (
                  <UserAvatar
                    size={80}
                    bgColor={PRIMARY_COLOR}
                    name={userData ? userData.name : ''}
                  />
                )}
                <View style={styles.verificationBadge}>
                  <MaterialCommunityIcons
                    name={verified ? "check-circle" : "close-circle"}
                    size={20}
                    color={verified ? "#25B07F" : "#F64E4E"}
                  />
                </View>
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {userData ? userData.name : 'User'}
                </Text>
                <Text style={styles.userEmail}>
                  {userData ? userData.email : 'user@example.com'}
                </Text>
                <View style={styles.verificationStatus}>
                  <View style={[styles.statusBadge, {backgroundColor: verified ? '#E8F5E8' : '#FFF3E0'}]}>
                    <MaterialCommunityIcons
                      name={verified ? "shield-check" : "shield-alert"}
                      size={14}
                      color={verified ? "#25B07F" : "#FF9800"}
                    />
                    <Text style={[styles.statusText, {color: verified ? "#25B07F" : "#FF9800"}]}>
                      {verified ? 'Verified' : 'Not Verified'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => {
                navigation.navigate('EditProfile', {user: userData});
              }}>
              <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Account Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionHeader}>Account Settings</Text>
          
          <Card style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => navigation.navigate('Feedback')}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, {backgroundColor: '#E3F2FD'}]}>
                  <MaterialCommunityIcons name="message-text" size={24} color="#2196F3" />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsItemTitle}>Feedback</Text>
                  <Text style={styles.settingsItemSubtitle}>Share your thoughts with us</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD3EE" />
            </TouchableOpacity>

            <Divider style={styles.divider} />

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                const url =
                  'https://www.termsfeed.com/live/2c961df9-554e-434f-a862-ebf55df1bd49';
                Linking.openURL(url);
              }}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, {backgroundColor: '#E8F5E8'}]}>
                  <MaterialCommunityIcons name="shield-check" size={24} color="#4CAF50" />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsItemTitle}>Privacy Policy</Text>
                  <Text style={styles.settingsItemSubtitle}>View our privacy terms</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD3EE" />
            </TouchableOpacity>

            <Divider style={styles.divider} />

            <TouchableOpacity style={styles.settingsItem} onPress={() => logout()}>
              <View style={styles.settingsItemLeft}>
                <View style={[styles.settingsIcon, {backgroundColor: '#FFEBEE'}]}>
                  <MaterialCommunityIcons name="logout" size={24} color="#F44336" />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={[styles.settingsItemTitle, {color: '#F44336'}]}>Logout</Text>
                  <Text style={styles.settingsItemSubtitle}>Sign out of your account</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD3EE" />
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F64E4E',
    textAlign: 'center',
    marginVertical: 15,
    fontFamily: 'Lato-Regular',
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  subHeaderText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  profileCardContent: {
    padding: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarSection: {
    position: 'relative',
    marginRight: 16,
  },
  verificationBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 4,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  userEmail: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Lato-Regular',
  },
  verificationStatus: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Lato-Bold',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  settingsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  settingsCard: {
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingsTextContainer: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 2,
    fontFamily: 'Lato-Bold',
  },
  settingsItemSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  divider: {
    marginHorizontal: 20,
    backgroundColor: '#F0F0F0',
  },
});
