import {View, Text, StyleSheet, ActivityIndicator, TouchableOpacity} from 'react-native';
import React, {useState, useContext} from 'react';
import {Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const ForgotPasswordScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const {forgotPassword} = useContext(AuthContext);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email) {
      setErrorMessage('Please enter an email address');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await forgotPassword(email);
      setSuccessMessage('Password reset email sent! Check your inbox and follow the instructions to reset your password.');
      setEmail(''); // Clear the email field after successful request
    } catch (error) {
      setErrorMessage('Error sending reset email. Please check your email address and try again.');
    } finally {
      setIsLoading(false);
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
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="lock-reset" size={60} color="#677CD2" />
            </View>
            <Text style={styles.headerText}>Forgot Password?</Text>
            <Text style={styles.subtitleText}>
              No worries! Enter your email address and we'll send you a link to reset your password
            </Text>
          </View>

          <Card style={styles.formCard}>
            <View style={styles.cardContent}>
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#C62828" />
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                </View>
              )}

              {successMessage && (
                <View style={styles.successContainer}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#2E7D32" />
                  <Text style={styles.successMessage}>{successMessage}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <FormInput
                  labelValue={email}
                  onChangeText={userEmail => setEmail(userEmail)}
                  placeholderText="Enter your email address"
                  iconType="mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#677CD2" />
                  <Text style={styles.loadingText}>Sending reset email...</Text>
                </View>
              ) : (
                <FormButton buttonTitle="Send Reset Email" onPress={handleForgotPassword} />
              )}
            </View>
          </Card>

          <Card style={styles.infoCard}>
            <View style={styles.infoCardContent}>
              <MaterialCommunityIcons name="information" size={24} color="#677CD2" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Need Help?</Text>
                <Text style={styles.infoText}>
                  If you don't receive the email within a few minutes, check your spam folder or contact support.
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.loginContainer}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginButtonText}>
                Remember your password? <Text style={styles.loginLinkText}>Sign in here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default ForgotPasswordScreen;

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
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#677CD2',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 10,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
    lineHeight: 22,
    paddingHorizontal: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  successMessage: {
    color: '#2E7D32',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#677CD2',
    fontFamily: 'Lato-Bold',
    marginBottom: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#677CD2',
    fontFamily: 'Lato-Regular',
    marginTop: 10,
  },
  infoCard: {
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
  infoCardContent: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#677CD2',
    fontFamily: 'Lato-Bold',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
    lineHeight: 18,
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
