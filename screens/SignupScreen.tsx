import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
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
import {CURRENCIES} from '../utils/CurrencyUtil';
import {useTheme} from '../src/theme';
import CurrencyPickerModal from '../src/components/CurrencyPickerModal';

interface PasswordValidation {
  length: boolean;
  numeric: boolean;
  special: boolean;
  lowercase: boolean;
  uppercase: boolean;
}

const SignupScreen = ({navigation}: {navigation: any}) => {
  const {colors} = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordValidation>({
      length: false,
      numeric: false,
      special: false,
      lowercase: false,
      uppercase: false,
    });
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const {register} = useContext(AuthContext);

  React.useEffect(() => {
    configureGoogleSignIn();
    setIsAppleSignInAvailable(configureAppleSignIn());
  }, []);

  const isValidEmail = (e: string) => /\S+@\S+\.\S+/.test(e);
  const isValidName = (n: string) => /^[a-zA-Z]+(?:[\s-][a-zA-Z]+)*$/.test(n);
  const isValidPhone = (p: string) => /^\d{10}$/.test(p);

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

  const getSelectedCurrencyInfo = () =>
    CURRENCIES.find(c => c.code === selectedCurrency) || CURRENCIES[0];

  const handleSignup = async () => {
    setErrorMessage(null);
    setLoading(true);
    if (!email) {
      setErrorMessage('Please enter an email address');
      setLoading(false);
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      setLoading(false);
      return;
    }
    if (!password) {
      setErrorMessage('Please enter a password');
      setLoading(false);
      return;
    }
    if (!confirmPassword) {
      setErrorMessage('Please confirm your password');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setLoading(false);
      return;
    }
    if (!isPasswordValid()) {
      setErrorMessage('Password must meet all requirements');
      setLoading(false);
      return;
    }
    if (!name) {
      setErrorMessage('Please enter your name');
      setLoading(false);
      return;
    }
    if (!isValidName(name)) {
      setErrorMessage('Please enter a valid name');
      setLoading(false);
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setErrorMessage('Please enter a valid phone number');
      setLoading(false);
      return;
    }
    try {
      await register(email, password, name, phone, selectedCurrency);
      setLoading(false);
    } catch (error: any) {
      setErrorMessage(
        error.code === 'auth/email-already-in-use'
          ? 'This email is already registered. Please use a different email or login.'
          : error.message || 'Registration failed',
      );
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
          });
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setErrorMessage('Google sign-up failed. Please try again.');
      }
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      if (error.code === statusCodes.IN_PROGRESS) {
        setErrorMessage('Sign-up is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setErrorMessage('Google Play Services not available or outdated');
      } else if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        setErrorMessage('Sign-up was cancelled');
      } else {
        setErrorMessage('Google sign-up failed. Please try again.');
      }
    }
  };

  const handleAppleSignUp = async () => {
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
          });
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setErrorMessage(
          result.error?.includes('revoked')
            ? 'Your Apple ID authorization has been revoked. Please try signing up again, or use a different sign-in method.'
            : result.error || 'Apple sign-up failed. Please try again.',
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
            ? 'Your Apple ID authorization has been revoked.'
            : error.message || 'Apple sign-up failed. Please try again.',
        );
      }
    }
  };

  const requirements: [boolean, string][] = [
    [passwordValidation.length, 'At least 6 characters'],
    [passwordValidation.numeric, 'At least 1 numeric character'],
    [passwordValidation.special, 'At least 1 special character'],
    [passwordValidation.lowercase, 'At least 1 lowercase letter'],
    [passwordValidation.uppercase, 'At least 1 uppercase letter'],
  ];

  const googleButton = (
    <TouchableOpacity
      className="mb-2.5 flex-row items-center justify-center rounded-lg border border-border bg-surface-muted px-4 py-3"
      onPress={handleGoogleSignUp}
      disabled={loading}>
      <Image
        source={{
          uri: 'https://developers.google.com/identity/images/g-logo.png',
        }}
        className="mr-3 h-5 w-5"
      />
      <Text className="font-sans text-base font-medium text-text">
        Sign up with Google
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        style={{flex: 1, width: '100%'}}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-5 pb-5 pt-10">
          <View className="mb-[30px] items-center">
            <Text className="mb-2 font-heading text-[32px] font-bold text-primary">
              Create Account
            </Text>
            <Text className="text-center font-sans text-base text-text-secondary">
              Start tracking your expenses with a new account
            </Text>
          </View>

          <View className="mb-5 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
            <View className="p-[25px]">
              {errorMessage && (
                <View
                  accessibilityRole="alert"
                  className="mb-5 rounded-xl border-l-4 border-expense bg-expense-soft p-[15px]">
                  <Text className="font-sans text-sm leading-5 text-expense-text">
                    {errorMessage}
                  </Text>
                </View>
              )}
              <View className="mb-[25px]">
                <Text className="mb-[15px] border-b-2 border-card-border pb-[5px] font-sans-bold text-lg font-semibold text-primary">
                  Personal Information
                </Text>
                <FormInput
                  labelValue={name}
                  onChangeText={setName}
                  placeholderText="Full Name"
                  iconType="user"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <FormInput
                  labelValue={email}
                  onChangeText={setEmail}
                  placeholderText="Email Address"
                  iconType="mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <FormInput
                  labelValue={phone}
                  onChangeText={setPhone}
                  placeholderText="Phone Number (Optional)"
                  iconType="phone"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View className="mb-[25px]">
                <Text className="mb-[15px] border-b-2 border-card-border pb-[5px] font-sans-bold text-lg font-semibold text-primary">
                  Preferences
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Choose currency"
                  className="flex-row items-center justify-between rounded-xl border border-card-border bg-surface p-4"
                  onPress={() => setCurrencyModalVisible(true)}>
                  <View className="flex-1 flex-row items-center">
                    <MaterialCommunityIcons
                      name="currency-usd"
                      size={20}
                      color={colors.primary}
                    />
                    <View className="ml-3 flex-1">
                      <Text className="mb-0.5 font-sans text-xs text-text-secondary">
                        Currency
                      </Text>
                      <Text className="font-sans-bold text-base text-text-strong">
                        {getSelectedCurrencyInfo().name} (
                        {getSelectedCurrencyInfo().symbol})
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={colors.textPlaceholder}
                  />
                </TouchableOpacity>
              </View>
              <View className="mb-[25px]">
                <Text className="mb-[15px] border-b-2 border-card-border pb-[5px] font-sans-bold text-lg font-semibold text-primary">
                  Security
                </Text>
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
                    {requirements.map(([met, label]) => (
                      <View key={label} className="mb-1">
                        <Text
                          className={`font-sans text-[13px] ${
                            met
                              ? 'font-semibold text-income-text'
                              : 'text-text-secondary'
                          }`}>
                          {met ? '✓' : '○'} {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <View className="relative mb-2.5">
                  <FormInput
                    labelValue={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholderText="Confirm Password"
                    iconType="lock"
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    className="absolute right-[15px] top-1/2 z-10 -translate-y-2.5"
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword ? 'Hide password' : 'Show password'
                    }
                    onPress={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }>
                    <MaterialCommunityIcons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  className="my-5"
                />
              ) : (
                <FormButton
                  buttonTitle="Create Account"
                  onPress={handleSignup}
                />
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
                    onPress={handleAppleSignUp}
                    disabled={loading}>
                    <MaterialCommunityIcons
                      name="apple"
                      size={20}
                      color={colors.onInverse}
                      className="mr-3"
                    />
                    <Text className="font-sans text-base font-medium text-on-inverse">
                      Sign up with Apple
                    </Text>
                  </TouchableOpacity>
                  {googleButton}
                </>
              ) : (
                googleButton
              )}
            </View>
          </View>

          <View className="mb-5 rounded-[15px] border border-card-border bg-surface ios:shadow-md">
            <View className="p-5">
              <Text className="text-center font-sans text-[13px] leading-[18px] text-text-secondary">
                By creating an account, you agree to our{' '}
                <Text
                  className="font-semibold text-primary underline"
                  onPress={() => navigation.navigate('PrivacyPolicy')}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>

          <View className="items-center pb-5">
            <TouchableOpacity
              className="p-[15px]"
              onPress={() => navigation.navigate('Login')}>
              <Text className="text-center font-sans text-base text-text-secondary">
                Already have an account?{' '}
                <Text className="font-semibold text-primary">Sign in here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <CurrencyPickerModal
        visible={currencyModalVisible}
        selectedCode={selectedCurrency}
        onSelect={code => {
          setSelectedCurrency(code);
          setCurrencyModalVisible(false);
        }}
        onClose={() => setCurrencyModalVisible(false)}
      />
    </View>
  );
};

export default SignupScreen;
