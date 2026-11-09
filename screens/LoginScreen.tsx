import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {Card} from 'react-native-paper';
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
import {
  getCrashlytics,
  setAttribute,
  setUserId,
} from '@react-native-firebase/crashlytics';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../src/constants/theme';

interface PasswordValidation {
  length: boolean;
  numeric: boolean;
  special: boolean;
  lowercase: boolean;
  uppercase: boolean;
}

const LoginScreen = ({navigation}: {navigation: any}) => {
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
        setUserId(getCrashlytics(), user.uid);
        setAttribute(getCrashlytics(), 'auth_method', 'google');
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
        setUserId(getCrashlytics(), user.uid);
        setAttribute(getCrashlytics(), 'auth_method', 'apple');
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

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        style={{flex: 1, width: '100%'}}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/Tracka.png')}
              style={styles.logo}
            />
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.subtitleText}>
              Sign in to continue tracking your expenses
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
              <FormInput
                labelValue={email}
                onChangeText={setEmail}
                placeholderText="Email"
                iconType="user"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
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
              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={PRIMARY_COLOR}
                  style={styles.loadingIndicator}
                />
              ) : (
                <FormButton buttonTitle="Sign In" onPress={handleSignIn} />
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
                    onPress={handleAppleSignIn}
                    disabled={loading}>
                    <MaterialCommunityIcons
                      name="apple"
                      size={20}
                      color="#FFFFFF"
                      style={styles.appleIcon}
                    />
                    <Text style={styles.appleButtonText}>
                      Sign in with Apple
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleSignIn}
                    disabled={loading}>
                    <Image
                      source={{
                        uri: 'https://developers.google.com/identity/images/g-logo.png',
                      }}
                      style={styles.googleIcon}
                    />
                    <Text style={styles.googleButtonText}>
                      Sign in with Google
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={loading}>
                  <Image
                    source={{
                      uri: 'https://developers.google.com/identity/images/g-logo.png',
                    }}
                    style={styles.googleIcon}
                  />
                  <Text style={styles.googleButtonText}>
                    Sign in with Google
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotButtonText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </Card>

          <View style={styles.signupContainer}>
            <TouchableOpacity
              style={styles.signupButton}
              onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupButtonText}>
                Don't have an account?{' '}
                <Text style={styles.signupLinkText}>Create one here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    justifyContent: 'center',
  },
  logoContainer: {alignItems: 'center', marginBottom: 30},
  logo: {height: 180, width: 180, resizeMode: 'cover', marginBottom: 20},
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 8,
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
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorMessage: {color: '#C62828', fontSize: 14, fontFamily: 'Lato-Regular'},
  loadingIndicator: {marginVertical: 20},
  forgotButton: {alignItems: 'center', marginTop: 20},
  forgotButtonText: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  signupContainer: {alignItems: 'center', paddingBottom: 40},
  signupButton: {padding: 15},
  signupButtonText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  signupLinkText: {color: PRIMARY_COLOR, fontWeight: '600'},
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
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
