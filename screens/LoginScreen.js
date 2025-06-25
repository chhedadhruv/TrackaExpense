import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {Card} from 'react-native-paper';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const {login} = useContext(AuthContext);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isValidPassword = password => {
    const re =
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[0-9a-zA-Z!@#$%^&*]{6,}$/;
    return re.test(password);
  };

  const handleSignIn = async () => {
    setErrorMessage(null);
    if (!email) {
      setErrorMessage('Please enter an email address');
    } else if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
    } else if (!password) {
      setErrorMessage('Please enter a password');
    } else if (!isValidPassword(password)) {
      setErrorMessage(
        'Password must contain at least 6 characters, one number, one uppercase letter, and one lowercase letter.',
      );
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

              <FormInput
                labelValue={password}
                onChangeText={setPassword}
                placeholderText="Password"
                iconType="lock"
                secureTextEntry={true}
              />

              {loading ? (
                <ActivityIndicator
                  size="large"
                  color="#677CD2"
                  style={styles.loadingIndicator}
                />
              ) : (
                <FormButton buttonTitle="Sign In" onPress={handleSignIn} />
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
});

export default LoginScreen;
