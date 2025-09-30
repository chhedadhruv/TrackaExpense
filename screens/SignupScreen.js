import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
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

const SignupScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    numeric: false,
    special: false,
    lowercase: false,
    uppercase: false,
  });
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);

  const {register} = useContext(AuthContext);

  // Configure Sign-In methods
  React.useEffect(() => {
    configureGoogleSignIn();
    setIsAppleSignInAvailable(configureAppleSignIn());
  }, []);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isValidName = name => {
    const re = /^[a-zA-Z]+(?:[\s-][a-zA-Z]+)*$/;
    return re.test(name);
  };


  const isValidPhone = phone => {
    const re = /^\d{10}$/;
    return re.test(phone);
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

  const handleSignup = async () => {
    setErrorMessage(null);
    setLoading(true);

    if (!email) {
      setErrorMessage('Please enter an email address');
      setLoading(false);
    } else if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      setLoading(false);
    } else if (!password) {
      setErrorMessage('Please enter a password');
      setLoading(false);
    } else if (!confirmPassword) {
      setErrorMessage('Please confirm your password');
      setLoading(false);
    } else if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setLoading(false);
    } else if (!isPasswordValid()) {
      setErrorMessage('Password must meet all requirements');
      setLoading(false);
    } else if (!name) {
      setErrorMessage('Please enter your name');
      setLoading(false);
    } else if (!isValidName(name)) {
      setErrorMessage('Please enter a valid name');
      setLoading(false);
    } else if (phone && !isValidPhone(phone)) {
      setErrorMessage('Please enter a valid phone number');
      setLoading(false);
    } else {
      try {
        await register(email, password, name, phone);
        setLoading(false);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          setErrorMessage('This email is already registered. Please use a different email or login.');
        } else {
          setErrorMessage(error.message || 'Registration failed');
        }
        setLoading(false);
      }
    }
  };

  const handleGoogleSignUp = async () => {
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
          // Create user document for new Google sign-up users
          await firestore().collection('users').doc(user.uid).set({
            name: user.displayName || 'Google User',
            email: user.email,
            phone: user.phoneNumber || '',
            transactions: [],
            verified: true,
            createdAt: firestore.Timestamp.fromDate(new Date()),
            userImg: user.photoURL || null,
          });
          console.log('Google Sign-Up: User document created successfully');
        } else {
          console.log('Google Sign-Up: User document already exists');
        }
        
        // Verify the document was created successfully
        const verifyDoc = await firestore().collection('users').doc(user.uid).get();
        if (!verifyDoc.exists) {
          throw new Error('Failed to create user document');
        }
        
        // Wait a moment to ensure Firestore is updated
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        setErrorMessage('Google sign-up failed. Please try again.');
      }
      
      setLoading(false);
    } catch (error) {
      setLoading(false);
      
      if (error.code) {
        switch (error.code) {
          case statusCodes.IN_PROGRESS:
            setErrorMessage('Sign-up is already in progress');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            setErrorMessage('Google Play Services not available or outdated');
            break;
          case statusCodes.SIGN_IN_CANCELLED:
            setErrorMessage('Sign-up was cancelled');
            break;
          case statusCodes.SIGN_IN_REQUIRED:
            setErrorMessage('Sign-up required');
            break;
          default:
            setErrorMessage('Google sign-up failed. Please try again.');
        }
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setErrorMessage('An account already exists with this email address using a different sign-in method.');
      } else if (error.code === 'auth/invalid-credential') {
        setErrorMessage('The credential received is malformed or has expired.');
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
          // Create user document for new Apple sign-up users
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
          console.log('Apple Sign-Up: User document created successfully');
        } else {
          console.log('Apple Sign-Up: User document already exists');
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
          setErrorMessage('Your Apple ID authorization has been revoked. Please try signing up again, or use a different sign-in method.');
        } else {
          setErrorMessage(result.error || 'Apple sign-up failed. Please try again.');
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
        setErrorMessage('Your Apple ID authorization has been revoked. Please try signing up again, or use a different sign-in method.');
      } else {
        setErrorMessage(error.message || 'Apple sign-up failed. Please try again.');
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

          <Card style={styles.formCard}>
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
                <Text style={styles.sectionTitle}>Security</Text>
                
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

                {/* Confirm Password Input */}
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
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
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
                  color="#677CD2"
                  style={styles.loader}
                />
              ) : (
                <FormButton buttonTitle="Create Account" onPress={handleSignup} />
              )}

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {Platform.OS === 'ios' && isAppleSignInAvailable ? (
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
                  <Text style={styles.appleButtonText}>Sign up with Apple</Text>
                </TouchableOpacity>
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
                  <Text style={styles.googleButtonText}>Sign up with Google</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          <Card style={styles.termsCard}>
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
                Already have an account? <Text style={styles.loginLinkText}>Sign in here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerText: {
    fontFamily: 'Kufam-SemiBoldItalic',
    fontSize: 32,
    color: '#677CD2',
    fontWeight: 'bold',
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
    padding: 25,
  },
  inputSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#677CD2',
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
  loader: {
    marginVertical: 20,
  },
  termsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    elevation: 4,
    shadowColor: '#677CD2',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: 20,
  },
  termsContent: {
    padding: 20,
  },
  termsText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#677CD2',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  loginContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  loginButton: {
    padding: 15,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  loginLinkText: {
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
