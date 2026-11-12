import React, {useContext, useState} from 'react';
import {useRouter} from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
} from '@react-native-firebase/auth';
import {
  Timestamp,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {configureGoogleSignIn} from '../utils/GoogleSignInConfig';
import {
  configureAppleSignIn,
  performAppleSignIn,
} from '../utils/AppleSignInConfig';
import {setErrorReportingTag} from '../src/services/ErrorReporter';
import * as AnalyticsService from '../src/services/AnalyticsService';
import Check from 'lucide-react-native/icons/check';
import Circle from 'lucide-react-native/icons/circle';
import {useTheme} from '../src/theme';

interface PasswordValidation {
  length: boolean;
  numeric: boolean;
  special: boolean;
  lowercase: boolean;
  uppercase: boolean;
}

const LoginScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordValidation>({
      length: false,
      numeric: false,
      special: false,
      lowercase: false,
      uppercase: false,
    });
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);
  const {login} = useContext(AuthContext);

  React.useEffect(() => {
    configureGoogleSignIn();
    setIsAppleSignInAvailable(configureAppleSignIn());
  }, []);

  const isValidEmail = (e: string) => /\S+@\S+\.\S+/.test(e);

  const validatePassword = (pwd: string) => {
    const v: PasswordValidation = {
      length: pwd.length >= 6,
      numeric: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      uppercase: /[A-Z]/.test(pwd),
    };
    setPasswordValidation(v);
    return Object.values(v).every(Boolean);
  };

  const isPasswordValid = () =>
    Object.values(passwordValidation).every(Boolean);

  const handleSignIn = async () => {
    setErrorMessage(null);
    if (!email) {
      setErrorMessage('Please enter an email address');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter a password');
      return;
    }
    if (!isPasswordValid()) {
      setErrorMessage('Password must meet all requirements');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (_) {
      setErrorMessage(
        'Login failed. Please check your credentials or try again later.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }
      const signInResult = await GoogleSignin.signIn();
      const idToken =
        (signInResult as any)?.idToken || (signInResult as any)?.data?.idToken;
      if (idToken) {
        const googleCredential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(
          getAuth(),
          googleCredential,
        );
        const user = userCredential.user;
        setErrorReportingTag('auth_method', 'google');
        AnalyticsService.logLogin('google');
        const userDoc = await getDoc(doc(getFirestore(), 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(getFirestore(), 'users', user.uid), {
            name: user.displayName || 'Google User',
            email: user.email,
            phone: user.phoneNumber || '',
            transactions: [],
            verified: true,
            createdAt: Timestamp.fromDate(new Date()),
            userImg: user.photoURL || null,
            balance: 0,
            currency: 'INR',
          });
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setErrorMessage(
          'Google sign-in failed. No authentication token received.',
        );
      }
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      if (error.code === statusCodes.IN_PROGRESS) {
        setErrorMessage('Sign-in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setErrorMessage('Google Play Services not available or outdated');
      } else if (
        error.code === statusCodes.SIGN_IN_CANCELLED ||
        error.code === 'E_SIGN_IN_CANCELLED'
      ) {
        setErrorMessage('Sign-in was cancelled');
      } else if (
        error.code === 'auth/account-exists-with-different-credential'
      ) {
        setErrorMessage(
          'An account already exists with this email address using a different sign-in method.',
        );
      } else {
        setErrorMessage(
          error.message || 'Google sign-in failed. Please try again.',
        );
      }
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const result = await performAppleSignIn();
      if (result.success) {
        const appleCredential = AppleAuthProvider.credential(
          result.identityToken,
          result.nonce,
        );
        const userCredential = await signInWithCredential(
          getAuth(),
          appleCredential,
        );
        const user = userCredential.user;
        setErrorReportingTag('auth_method', 'apple');
        AnalyticsService.logLogin('apple');
        const userDoc = await getDoc(doc(getFirestore(), 'users', user.uid));
        if (!userDoc.exists()) {
          const displayName = result.fullName
            ? `${result.fullName.givenName || ''} ${
                result.fullName.familyName || ''
              }`.trim()
            : 'Apple User';
          await setDoc(doc(getFirestore(), 'users', user.uid), {
            name: displayName || 'Apple User',
            email: result.email || user.email || '',
            phone: '',
            transactions: [],
            verified: true,
            createdAt: Timestamp.fromDate(new Date()),
            userImg: null,
            balance: 0,
            currency: 'INR',
          });
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setErrorMessage(
          result.error?.includes('revoked')
            ? 'Your Apple ID authorization has been revoked. Please try signing in again, or use a different sign-in method.'
            : result.error || 'Apple sign-in failed. Please try again.',
        );
      }
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      if (error.code === 'auth/account-exists-with-different-credential') {
        setErrorMessage(
          'An account already exists with this email address using a different sign-in method.',
        );
      } else {
        setErrorMessage(
          error.message?.includes('revoked')
            ? 'Your Apple ID authorization has been revoked. Please try signing in again, or use a different sign-in method.'
            : error.message || 'Apple sign-in failed. Please try again.',
        );
      }
    }
  };

  const googleButton = (
    <TouchableOpacity
      className="mb-2.5 flex-row items-center justify-center rounded-lg border border-border bg-surface-muted px-4 py-3"
      onPress={handleGoogleSignIn}
      disabled={loading}>
      <Image
        source={{
          uri: 'https://developers.google.com/identity/images/g-logo.png',
        }}
        className="mr-3 h-5 w-5"
      />
      <Text className="font-sans text-base font-medium text-text">
        Sign in with Google
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="w-full flex-1"
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 justify-center px-5 pt-10">
          <View className="mb-[30px] items-center">
            <Image
              source={require('../assets/login-logo.png')}
              className="mb-6 h-[120px] w-[120px] rounded-[27px]"
              resizeMode="contain"
            />
            <Text className="mb-2 font-heading text-[28px] font-bold text-primary">
              Welcome Back!
            </Text>
            <Text className="text-center font-sans text-base text-text-secondary">
              Sign in to continue tracking your expenses
            </Text>
          </View>

          <View className="mb-5 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
            <View className="p-[30px]">
              {errorMessage && (
                <View
                  accessibilityRole="alert"
                  className="mb-5 rounded-lg border-l-4 border-expense bg-expense-soft p-3">
                  <Text className="font-sans text-sm text-expense-text">
                    {errorMessage}
                  </Text>
                </View>
              )}
              <FormInput
                labelValue={email}
                onChangeText={setEmail}
                placeholderText="Email"
                iconType="user"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View className="relative mb-2.5">
                <FormInput
                  labelValue={password}
                  onChangeText={text => {
                    setPassword(text);
                    validatePassword(text);
                  }}
                  placeholderText="Password"
                  iconType="lock"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  className="absolute right-[15px] top-1/2 z-10 -translate-y-2.5"
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  onPress={() => setShowPassword(!showPassword)}>
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && (
                <View className="mb-[15px] rounded-lg border-l-[3px] border-primary bg-surface-muted p-3">
                  <Text className="mb-2 font-sans-bold text-sm font-semibold text-text">
                    Password Requirements:
                  </Text>
                  {(
                    [
                      [passwordValidation.length, 'At least 6 characters'],
                      [
                        passwordValidation.numeric,
                        'At least 1 numeric character',
                      ],
                      [
                        passwordValidation.special,
                        'At least 1 special character',
                      ],
                      [
                        passwordValidation.lowercase,
                        'At least 1 lowercase letter',
                      ],
                      [
                        passwordValidation.uppercase,
                        'At least 1 uppercase letter',
                      ],
                    ] as [boolean, string][]
                  ).map(([met, label]) => (
                    <View key={label} className="mb-1 flex-row items-center">
                      {met ? (
                        <Check size={14} color={colors.incomeText} />
                      ) : (
                        <Circle size={14} color={colors.textSecondary} />
                      )}
                      <Text
                        className={`ml-1.5 font-sans text-[13px] ${
                          met
                            ? 'font-semibold text-income-text'
                            : 'text-text-secondary'
                        }`}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  className="my-5"
                />
              ) : (
                <FormButton buttonTitle="Sign In" onPress={handleSignIn} />
              )}
              <View className="my-5 flex-row items-center">
                <View className="h-px flex-1 bg-border" />
                <Text className="mx-[15px] font-sans text-sm text-text-secondary">
                  OR
                </Text>
                <View className="h-px flex-1 bg-border" />
              </View>
              {Platform.OS === 'ios' && isAppleSignInAvailable ? (
                <>
                  <TouchableOpacity
                    className="mb-2.5 flex-row items-center justify-center rounded-lg bg-inverse px-4 py-3"
                    onPress={handleAppleSignIn}
                    disabled={loading}>
                    <MaterialCommunityIcons
                      name="apple"
                      size={20}
                      color={colors.onInverse}
                      className="mr-3"
                    />
                    <Text className="font-sans text-base font-medium text-on-inverse">
                      Sign in with Apple
                    </Text>
                  </TouchableOpacity>
                  {googleButton}
                </>
              ) : (
                googleButton
              )}
              <TouchableOpacity
                className="mt-5 items-center"
                onPress={() => router.navigate('/forgot-password')}>
                <Text className="font-sans text-base font-medium text-primary">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="items-center pb-10">
            <TouchableOpacity
              className="p-[15px]"
              onPress={() => router.navigate('/signup')}>
              <Text className="text-center font-sans text-base text-text-secondary">
                Don't have an account?{' '}
                <Text className="font-semibold text-primary">
                  Create one here
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default LoginScreen;
