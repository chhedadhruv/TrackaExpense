import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Platform } from 'react-native';
import {Card} from 'react-native-paper';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { configureGoogleSignIn } from '../utils/GoogleSignInConfig';
import { configureAppleSignIn, performAppleSignIn } from '../utils/AppleSignInConfig';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    numeric: false,
    special: false,
    lowercase: false,
    uppercase: false,
  });
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);

  const {login} = useContext(AuthContext);

  // Configure Sign-In methods
  React.useEffect(() => {
    configureGoogleSignIn();
    setIsAppleSignInAvailable(configureAppleSignIn());
  }, []);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isValidPassword = password => {
    const re =
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[0-9a-zA-Z!@#$%^&*]{6,}$/;
    return re.test(password);
  };

  const validatePassword = (password) => {
    const validation = {
      length: password.length >= 6,
      numeric: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
    };
    setPasswordValidation(validation);
    return Object.values(validation).every(Boolean);
  };

  const isPasswordValid = () => {
    return Object.values(passwordValidation).every(Boolean);
  };

  const handleSignIn = async () => {
    setErrorMessage(null);
    if (!email) {
      setErrorMessage('Please enter an email address');
    } else if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
    } else if (!password) {
      setErrorMessage('Please enter a password');
    } else if (!isPasswordValid()) {
      setErrorMessage('Password must meet all requirements');
    } else {
      setLoading(true);
      try {
        await login(email, password);
      } catch (error) {
        setErrorMessage(
          'Login failed. Please check your credentials or try again later.',
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      // Android-only: ensure Google Play Services
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      
      // Sign-in and get the user's ID token
      const signInResult = await GoogleSignin.signIn();
      
      // Extract tokens from the result
      const idToken = signInResult?.idToken || 
                     signInResult?.data?.idToken || 
                     signInResult?.user?.idToken ||
                     signInResult?.idToken;
      const accessToken = signInResult?.accessToken || 
                         signInResult?.data?.accessToken || 
                         signInResult?.user?.accessToken ||
                         signInResult?.accessToken;
      
      if (idToken) {
        
        // Create a Google credential with the token
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);
        
        // Sign-in the user with the credential
        const userCredential = await auth().signInWithCredential(googleCredential);
        const user = userCredential.user;
        
        // Check if user exists in Firestore, if not create the user document
        const userDoc = await firestore().collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
          // Create user document for new Google sign-in users
          await firestore().collection('users').doc(user.uid).set({
            name: user.displayName || 'Google User',
            email: user.email,
            phone: user.phoneNumber || '',
            transactions: [],
            verified: true,
            createdAt: firestore.Timestamp.fromDate(new Date()),
            userImg: user.photoURL || null,
          });
          console.log('Google Sign-In: User document created successfully');
        } else {
          console.log('Google Sign-In: User document already exists');
        }
        
        // Verify the document was created successfully
        const verifyDoc = await firestore().collection('users').doc(user.uid).get();
        if (!verifyDoc.exists) {
          throw new Error('Failed to create user document');
        }
        
        // Wait a moment to ensure Firestore is updated
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setErrorMessage('Google sign-in failed. No authentication token received.');
      }
      
      setLoading(false);
    } catch (error) {
      setLoading(false);
      
      if (error.code) {
        switch (error.code) {
          case statusCodes.IN_PROGRESS:
            setErrorMessage('Sign-in is already in progress');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            setErrorMessage('Google Play Services not available or outdated');
            break;
          case statusCodes.SIGN_IN_CANCELLED:
            setErrorMessage('Sign-in was cancelled');
            break;
          case statusCodes.SIGN_IN_REQUIRED:
            setErrorMessage('Sign-in required');
            break;
          case 'E_SIGN_IN_CANCELLED':
            setErrorMessage('Sign-in was cancelled by user');
            break;
          case 'E_SIGN_IN_FAILED':
            setErrorMessage('Sign-in failed. Please try again.');
            break;
          default:
            setErrorMessage(`Google sign-in failed: ${error.message || 'Unknown error'}`);
        }
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setErrorMessage('An account already exists with this email address using a different sign-in method.');
      } else if (error.code === 'auth/invalid-credential') {
        setErrorMessage('The credential received is malformed or has expired.');
      } else {
        setErrorMessage('Google sign-in failed. Please try again.');
      }
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const result = await performAppleSignIn();
      
      if (result.success) {
        // Create Apple credential using the official Firebase format
        const appleCredential = auth.AppleAuthProvider.credential(
          result.identityToken,
          result.nonce
        );
        
        // Sign-in the user with the credential
        const userCredential = await auth().signInWithCredential(appleCredential);
        const user = userCredential.user;
        
        // Check if user exists in Firestore, if not create the user document
        const userDoc = await firestore().collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
          // Create user document for new Apple sign-in users
          const displayName = result.fullName ? 
            `${result.fullName.givenName || ''} ${result.fullName.familyName || ''}`.trim() : 
            'Apple User';
          
          await firestore().collection('users').doc(user.uid).set({
            name: displayName || 'Apple User',
            email: result.email || user.email || '',
            phone: '', // Apple Sign-In doesn't provide phone number
            transactions: [],
            verified: true,
            createdAt: firestore.Timestamp.fromDate(new Date()),
            userImg: null, // Apple Sign-In doesn't provide profile image
          });
          console.log('Apple Sign-In: User document created successfully');
        } else {
          console.log('Apple Sign-In: User document already exists');
        }
        
        // Verify the document was created successfully
        const verifyDoc = await firestore().collection('users').doc(user.uid).get();
        if (!verifyDoc.exists) {
          throw new Error('Failed to create user document');
        }
        
        // Wait a moment to ensure Firestore is updated
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Handle specific error cases
        if (result.error && result.error.includes('revoked')) {
          setErrorMessage('Your Apple ID authorization has been revoked. Please try signing in again, or use a different sign-in method.');
        } else {
          setErrorMessage(result.error || 'Apple sign-in failed. Please try again.');
        }
      }
      
      setLoading(false);
    } catch (error) {
      setLoading(false);
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        setErrorMessage('An account already exists with this email address using a different sign-in method.');
      } else if (error.code === 'auth/invalid-credential') {
        setErrorMessage('The credential received is malformed or has expired.');
      } else if (error.message && error.message.includes('revoked')) {
        setErrorMessage('Your Apple ID authorization has been revoked. Please try signing in again, or use a different sign-in method.');
      } else {
        setErrorMessage(error.message || 'Apple sign-in failed. Please try again.');
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
            <Image source={require('../assets/Tracka.png')} style={styles.logo} />
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.subtitleText}>Sign in to continue tracking your expenses</Text>
          </View>

          <Card style={styles.formCard}>
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

              {/* Password Input */}
              <View style={styles.passwordContainer}>
                <FormInput
                  labelValue={password}
                  onChangeText={(text) => {
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

              {/* Password Validation */}
              {password.length > 0 && (
                <View style={styles.validationContainer}>
                  <Text style={styles.validationTitle}>Password Requirements:</Text>
                  <View style={styles.validationItem}>
                    <Text style={[styles.validationText, passwordValidation.length && styles.validText]}>
                      {passwordValidation.length ? '✓' : '○'} At least 6 characters
                    </Text>
                  </View>
                  <View style={styles.validationItem}>
                    <Text style={[styles.validationText, passwordValidation.numeric && styles.validText]}>
                      {passwordValidation.numeric ? '✓' : '○'} At least 1 numeric character
                    </Text>
                  </View>
                  <View style={styles.validationItem}>
                    <Text style={[styles.validationText, passwordValidation.special && styles.validText]}>
                      {passwordValidation.special ? '✓' : '○'} At least 1 special character
                    </Text>
                  </View>
                  <View style={styles.validationItem}>
                    <Text style={[styles.validationText, passwordValidation.lowercase && styles.validText]}>
                      {passwordValidation.lowercase ? '✓' : '○'} At least 1 lowercase letter
                    </Text>
                  </View>
                  <View style={styles.validationItem}>
                    <Text style={[styles.validationText, passwordValidation.uppercase && styles.validText]}>
                      {passwordValidation.uppercase ? '✓' : '○'} At least 1 uppercase letter
                    </Text>
                  </View>
                </View>
              )}

              {loading ? (
                <ActivityIndicator
                  size="large"
                  color="#677CD2"
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
                  <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                </TouchableOpacity>
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
                  <Text style={styles.googleButtonText}>Sign in with Google</Text>
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
                Don't have an account? <Text style={styles.signupLinkText}>Create one here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    height: 180,
    width: 180,
    resizeMode: 'cover',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#677CD2',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#677CD2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20,
  },
  cardContent: {
    padding: 30,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorMessage: {
    color: '#C62828',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotButtonText: {
    fontSize: 16,
    color: '#677CD2',
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  signupContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  signupButton: {
    padding: 15,
  },
  signupButtonText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  signupLinkText: {
    color: '#677CD2',
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  appleIcon: {
    marginRight: 12,
  },
  appleButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -10 }],
    zIndex: 1,
  },
  validationContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#677CD2',
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Lato-Bold',
    marginBottom: 8,
  },
  validationItem: {
    marginBottom: 4,
  },
  validationText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  validText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default LoginScreen;
