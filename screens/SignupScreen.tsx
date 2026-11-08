import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import {Card} from 'react-native-paper';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
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
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../src/constants/theme';

interface PasswordValidation {
  length: boolean;
  numeric: boolean;
  special: boolean;
  lowercase: boolean;
  uppercase: boolean;
}

const SignupScreen = ({navigation}: {navigation: any}) => {
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

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        style={{flex: 1, width: '100%'}}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>Create Account</Text>
            <Text style={styles.subtitleText}>
              Start tracking your expenses with a new account
            </Text>
          </View>

          <Card
            style={[
              styles.formCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 4}>
            <View style={styles.cardContent}>
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                </View>
              )}
              <View style={styles.inputSection}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
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
              <View style={styles.inputSection}>
                <Text style={styles.sectionTitle}>Preferences</Text>
                <TouchableOpacity
                  style={styles.currencySelector}
                  onPress={() => setCurrencyModalVisible(true)}>
                  <View style={styles.currencySelectorLeft}>
                    <MaterialCommunityIcons
                      name="currency-usd"
                      size={20}
                      color={PRIMARY_COLOR}
                    />
                    <View style={styles.currencySelectorText}>
                      <Text style={styles.currencyLabel}>Currency</Text>
                      <Text style={styles.currencyValue}>
                        {getSelectedCurrencyInfo().name} (
                        {getSelectedCurrencyInfo().symbol})
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputSection}>
                <Text style={styles.sectionTitle}>Security</Text>
                <View style={styles.passwordContainer}>
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
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}>
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
                {password.length > 0 && (
                  <View style={styles.validationContainer}>
                    <Text style={styles.validationTitle}>
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
                      <View key={label} style={styles.validationItem}>
                        <Text
                          style={[
                            styles.validationText,
                            met && styles.validText,
                          ]}>
                          {met ? '✓' : '○'} {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.passwordContainer}>
                  <FormInput
                    labelValue={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholderText="Confirm Password"
                    iconType="lock"
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }>
                    <MaterialCommunityIcons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={PRIMARY_COLOR}
                  style={styles.loader}
                />
              ) : (
                <FormButton
                  buttonTitle="Create Account"
                  onPress={handleSignup}
                />
              )}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
              {Platform.OS === 'ios' && isAppleSignInAvailable ? (
                <>
                  <TouchableOpacity
                    style={styles.appleButton}
                    onPress={handleAppleSignUp}
                    disabled={loading}>
                    <MaterialCommunityIcons
                      name="apple"
                      size={20}
                      color="#FFFFFF"
                      style={styles.appleIcon}
                    />
                    <Text style={styles.appleButtonText}>
                      Sign up with Apple
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleSignUp}
                    disabled={loading}>
                    <Image
                      source={{
                        uri: 'https://developers.google.com/identity/images/g-logo.png',
                      }}
                      style={styles.googleIcon}
                    />
                    <Text style={styles.googleButtonText}>
                      Sign up with Google
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignUp}
                  disabled={loading}>
                  <Image
                    source={{
                      uri: 'https://developers.google.com/identity/images/g-logo.png',
                    }}
                    style={styles.googleIcon}
                  />
                  <Text style={styles.googleButtonText}>
                    Sign up with Google
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          <Card
            style={[
              styles.termsCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.termsContent}>
              <Text style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => navigation.navigate('PrivacyPolicy')}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </Card>

          <View style={styles.loginContainer}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginButtonText}>
                Already have an account?{' '}
                <Text style={styles.loginLinkText}>Sign in here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.currencyList}
              showsVerticalScrollIndicator={false}>
              {CURRENCIES.map(curr => (
                <TouchableOpacity
                  key={curr.code}
                  style={[
                    styles.currencyItem,
                    selectedCurrency === curr.code &&
                      styles.currencyItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCurrency(curr.code);
                    setCurrencyModalVisible(false);
                  }}>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencySymbol}>{curr.symbol}</Text>
                    <View style={styles.currencyDetails}>
                      <Text style={styles.currencyName}>{curr.name}</Text>
                      <Text style={styles.currencyCode}>{curr.code}</Text>
                    </View>
                  </View>
                  {selectedCurrency === curr.code && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={PRIMARY_COLOR}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  content: {flex: 1, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20},
  headerContainer: {alignItems: 'center', marginBottom: 30},
  headerText: {
    fontFamily: 'Kufam-SemiBoldItalic',
    fontSize: 32,
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  formCard: {backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 20},
  cardContent: {padding: 25},
  inputSection: {marginBottom: 25},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#E8EBF7',
    paddingBottom: 5,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorMessage: {
    color: '#C62828',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    lineHeight: 20,
  },
  loader: {marginVertical: 20},
  termsCard: {backgroundColor: '#FFFFFF', borderRadius: 15, marginBottom: 20},
  termsContent: {padding: 20},
  termsText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  loginContainer: {alignItems: 'center', paddingBottom: 20},
  loginButton: {padding: 15},
  loginButtonText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  loginLinkText: {color: PRIMARY_COLOR, fontWeight: '600'},
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {flex: 1, height: 1, backgroundColor: '#E0E0E0'},
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    elevation: Platform.OS === 'android' ? 0 : 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  googleIcon: {width: 20, height: 20, marginRight: 12},
  googleButtonText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    elevation: Platform.OS === 'android' ? 0 : 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  appleIcon: {marginRight: 12},
  appleButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  passwordContainer: {position: 'relative', marginBottom: 10},
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{translateY: -10}],
    zIndex: 1,
  },
  validationContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY_COLOR,
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Lato-Bold',
    marginBottom: 8,
  },
  validationItem: {marginBottom: 4},
  validationText: {fontSize: 13, color: '#666', fontFamily: 'Lato-Regular'},
  validText: {color: '#4CAF50', fontWeight: '600'},
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  currencySelectorLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  currencySelectorText: {marginLeft: 12, flex: 1},
  currencyLabel: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginBottom: 2,
  },
  currencyValue: {fontSize: 16, color: '#2C2C2C', fontFamily: 'Lato-Bold'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  currencyList: {paddingHorizontal: 20, paddingTop: 10},
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#F8F9FA',
  },
  currencyItemSelected: {
    backgroundColor: '#E8EBF7',
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
  },
  currencyInfo: {flexDirection: 'row', alignItems: 'center', flex: 1},
  currencySymbol: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginRight: 16,
    width: 40,
    textAlign: 'center',
  },
  currencyDetails: {flex: 1},
  currencyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  currencyCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
