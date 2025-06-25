import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {Card} from 'react-native-paper';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const SignupScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const {register} = useContext(AuthContext);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isValidName = name => {
    const re = /^[a-zA-Z]+(?:[\s-][a-zA-Z]+)*$/;
    return re.test(name);
  };

  const isValidBalance = balance => {
    const re = /^\d+(\.\d{1,2})?$/;
    return re.test(balance);
  };

  const isValidPhone = phone => {
    const re = /^\d{10}$/;
    return re.test(phone);
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
    } else if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      setLoading(false);
    } else if (!name) {
      setErrorMessage('Please enter your name');
      setLoading(false);
    } else if (!isValidName(name)) {
      setErrorMessage('Please enter a valid name');
      setLoading(false);
    } else if (!phone) {
      setErrorMessage('Please enter your phone number');
      setLoading(false);
    } else if (!isValidPhone(phone)) {
      setErrorMessage('Please enter a valid phone number');
      setLoading(false);
    } else if (!balance) {
      setErrorMessage('Please enter your balance');
      setLoading(false);
    } else if (!isValidBalance(balance)) {
      setErrorMessage('Please enter a valid balance');
      setLoading(false);
    } else {
      try {
        await register(email, password, name, phone, parseFloat(balance));
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
                  placeholderText="Phone Number"
                  iconType="phone"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.sectionTitle}>Financial Information</Text>
                <FormInput
                  labelValue={balance}
                  onChangeText={setBalance}
                  placeholderText="Initial Balance"
                  iconType="wallet"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.balanceInfoCard}>
                  <Text style={styles.balanceInfo}>
                    💡 Enter your current account balance to get started with accurate expense tracking
                  </Text>
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.sectionTitle}>Security</Text>
                <FormInput
                  labelValue={password}
                  onChangeText={setPassword}
                  placeholderText="Password"
                  iconType="lock"
                  secureTextEntry={true}
                />
                <FormInput
                  labelValue={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderText="Confirm Password"
                  iconType="lock"
                  secureTextEntry={true}
                />
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
            </View>
          </Card>

          <Card style={styles.termsCard}>
            <View style={styles.termsContent}>
              <Text style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <TouchableOpacity onPress={() => alert('Terms Clicked!')}>
                  <Text style={styles.termsLink}>Terms of Service</Text>
                </TouchableOpacity>
                {' '}and{' '}
                <TouchableOpacity onPress={() => alert('Privacy Policy Clicked!')}>
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </TouchableOpacity>
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
  balanceInfoCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#677CD2',
  },
  balanceInfo: {
    fontSize: 13,
    color: '#555',
    fontFamily: 'Lato-Regular',
    lineHeight: 18,
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
});
