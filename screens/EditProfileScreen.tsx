import React, {useState, useEffect} from 'react';
import {View, Alert, StyleSheet, SafeAreaView, Platform} from 'react-native';
import {ActivityIndicator, Text, Card} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import FormButton from '../components/FormButton';
import FormInput from '../components/FormInput';
import {
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../src/constants/theme';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  balance?: number;
}

const EditProfileScreen = ({navigation}: {navigation: any}) => {
  const [userData, setUserData] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = getAuth().currentUser;
        if (!currentUser) {
          Alert.alert('Error', 'No user is logged in');
          navigation.goBack();
          return;
        }
        const snap = await getDoc(
          doc(getFirestore(), 'users', currentUser.uid),
        );
        if (snap.exists()) {
          const data = snap.data()!;
          setUserData({
            name: data.name ?? '',
            email: data.email ?? '',
            phone: data.phone ?? '',
            balance: data.balance,
          });
        } else {
          setErrorMessage('User data not found');
        }
      } catch (_) {
        setErrorMessage('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateEmail = (email: string) =>
    /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(email);

  const validateInputs = () => {
    if (!userData.name || userData.name.trim().length < 2) {
      setErrorMessage('Name must be at least 2 characters long');
      return false;
    }
    if (!userData.email || !validateEmail(userData.email)) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }
    if (!userData.phone || userData.phone.length < 10) {
      setErrorMessage('Phone number must be at least 10 digits');
      return false;
    }
    return true;
  };

  const handleUpdate = async () => {
    setErrorMessage('');
    if (!validateInputs()) {
      return;
    }
    setUpdating(true);
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      setUpdating(false);
      return;
    }
    try {
      await updateDoc(doc(getFirestore(), 'users', currentUser.uid), {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        balance: userData.balance,
      });
      Alert.alert(
        'Success! 🎉',
        'Your profile has been updated successfully.',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (_) {
      setUpdating(false);
      setErrorMessage(
        'Failed to update profile. Please check your connection and try again.',
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="account-edit"
              size={48}
              color={PRIMARY_COLOR}
            />
          </View>
          <Text style={styles.titleText}>Edit Profile</Text>
          <Text style={styles.subtitleText}>
            Update your personal information
          </Text>
        </View>

        <Card
          style={[
            styles.formCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 4}>
          <View style={styles.cardContent}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#C62828"
                />
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              </View>
            ) : null}
            <View style={styles.inputSection}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <FormInput
                labelValue={userData.name}
                onChangeText={(name: string) => {
                  setUserData({...userData, name});
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                placeholderText="Full Name"
                iconType="user"
                autoCapitalize="words"
                autoCorrect={false}
              />
              <FormInput
                labelValue={userData.email}
                onChangeText={(email: string) => {
                  setUserData({...userData, email});
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                placeholderText="Email Address"
                iconType="mail"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <FormInput
                labelValue={userData.phone}
                onChangeText={(phone: string) => {
                  setUserData({...userData, phone});
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                placeholderText="Phone Number"
                iconType="phone"
                keyboardType="phone-pad"
                autoCapitalize="none"
                maxLength={15}
              />
            </View>
            {updating ? (
              <View style={styles.updatingContainer}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={styles.loadingText}>Updating your profile...</Text>
              </View>
            ) : (
              <FormButton buttonTitle="Update Profile" onPress={handleUpdate} />
            )}
          </View>
        </Card>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color={PRIMARY_COLOR}
            />
            <Text style={styles.infoText}>
              Your information is secure and encrypted
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons
              name="sync"
              size={20}
              color={PRIMARY_COLOR}
            />
            <Text style={styles.infoText}>
              Changes will sync across all your devices
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  scrollContent: {padding: 20, paddingBottom: 40},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },
  updatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginTop: 12,
  },
  headerSection: {alignItems: 'center', marginBottom: 30, paddingTop: 20},
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  formCard: {backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 20},
  cardContent: {padding: 30},
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorMessage: {
    color: '#C62828',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    marginLeft: 8,
    flex: 1,
  },
  inputSection: {marginBottom: 25},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
    marginBottom: 20,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: Platform.OS === 'android' ? 0 : 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  infoItem: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  infoText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginLeft: 12,
    flex: 1,
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
