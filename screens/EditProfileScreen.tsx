import React, {useState, useEffect} from 'react';
import {useRouter} from 'expo-router';
import {View, Text} from 'react-native';
import {ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import FormButton from '../components/FormButton';
import FormInput from '../components/FormInput';
import {
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {useTheme} from '../src/theme';
import {FormError} from '../src/components/form/FormParts';
import {snackbar} from '../src/utils/snackbarStore';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  balance?: number;
}

const EditProfileScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
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
          snackbar.error('No user is logged in');
          router.back();
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
      snackbar.success('Profile updated successfully');
      router.back();
    } catch (_) {
      setUpdating(false);
      setErrorMessage(
        'Failed to update profile. Please check your connection and try again.',
      );
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-3 font-sans text-base text-text-secondary">
          Loading your profile...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="p-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="mb-[30px] items-center pt-5">
          <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
            <MaterialCommunityIcons
              name="account-edit"
              size={48}
              color={colors.primary}
            />
          </View>
          <Text
            accessibilityRole="header"
            className="mb-2 text-center font-heading text-[28px] font-bold text-text-strong">
            Edit Profile
          </Text>
          <Text className="text-center font-sans text-base text-text-secondary">
            Update your personal information
          </Text>
        </View>

        <View className="mb-5 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
          <View className="p-[30px]">
            {errorMessage ? <FormError message={errorMessage} /> : null}
            <View className="mb-[25px]">
              <Text className="mb-5 font-sans-bold text-lg font-semibold text-text-strong">
                Personal Information
              </Text>
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
              <View className="items-center justify-center py-5">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="mt-3 font-sans text-base text-text-secondary">
                  Updating your profile...
                </Text>
              </View>
            ) : (
              <FormButton buttonTitle="Update Profile" onPress={handleUpdate} />
            )}
          </View>
        </View>

        <View className="rounded-2xl border border-card-border bg-surface p-5 ios:shadow-md">
          <View className="mb-3 flex-row items-center">
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color={colors.primary}
            />
            <Text className="ml-3 flex-1 font-sans text-sm text-text-secondary">
              Your information is secure and encrypted
            </Text>
          </View>
          <View className="flex-row items-center">
            <MaterialCommunityIcons
              name="sync"
              size={20}
              color={colors.primary}
            />
            <Text className="ml-3 flex-1 font-sans text-sm text-text-secondary">
              Changes will sync across all your devices
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default EditProfileScreen;
