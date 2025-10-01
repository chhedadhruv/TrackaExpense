import { View, Text, Alert } from 'react-native';
import React, { createContext, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
export const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Helper function to validate and ensure user data exists in Firestore
  const validateUserData = async (user) => {
    if (!user || !user.uid) return false;
    
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      return userDoc.exists;
    } catch (error) {
      console.error('Error validating user data:', error);
      return false;
    }
  };
  const handleAuthError = (error) => {
    const errorMessages = {
      'auth/user-not-found': {
        title: 'Account Not Found',
        message: 'No account found with this email address. Please check your email or sign up for a new account.',
      },
      'auth/wrong-password': {
        title: 'Incorrect Password',
        message: 'The password you entered is incorrect. Please try again or reset your password.',
      },
      'auth/invalid-email': {
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
      },
      'auth/user-disabled': {
        title: 'Account Disabled',
        message: 'This account has been disabled. Please contact support for assistance.',
      },
      'auth/too-many-requests': {
        title: 'Too Many Attempts',
        message: 'Too many unsuccessful login attempts. Please wait a moment and try again.',
      },
      'auth/operation-not-allowed': {
        title: 'Operation Not Allowed',
        message: 'This sign-in method is not enabled. Please contact support.',
      },
      'auth/email-already-in-use': {
        title: 'Email Already Registered',
        message: 'An account with this email already exists. Please use a different email or try logging in.',
      },
      'auth/invalid-credential': {
        title: 'Login Failed',
        message: 'Invalid email or password. Please check your credentials and try again.',
      },
    };
    const alertData = errorMessages[error.code];
    if (alertData) {
      Alert.alert(alertData.title, alertData.message, [{ text: 'OK' }]);
    } else {
      Alert.alert('Error', error.message, [{ text: 'OK' }]);
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        validateUserData,
        login: async (email, password) => {
          if (!email || !password) {
            Alert.alert('Missing Information', 'Please enter both email and password.', [{ text: 'OK' }]);
            return;
          }
          try {
            const userCredential = await auth().signInWithEmailAndPassword(email, password);
            const currentUser = userCredential.user;
            // Check if email is verified
            if (!currentUser.emailVerified) {
              // Sign out the user
              await auth().signOut();
              // Alert the user about email verification with more helpful message
              Alert.alert(
                'Email Verification Required', 
                'Please verify your email address before logging in. Check your inbox (and spam folder) for the verification email we sent when you signed up.\n\nDidn\'t receive the email? You can request a new one from the signup screen.', 
                [
                  { text: 'OK' },
                  { 
                    text: 'Resend Email', 
                    onPress: async () => {
                      try {
                        // Sign in temporarily to send verification email
                        const tempUser = await auth().signInWithEmailAndPassword(email, password);
                        await tempUser.user.sendEmailVerification();
                        await auth().signOut();
                        Alert.alert('Verification Email Sent', 'A new verification email has been sent to your inbox.', [{ text: 'OK' }]);
                      } catch (error) {
                        Alert.alert('Error', 'Failed to send verification email. Please try again later.', [{ text: 'OK' }]);
                      }
                    }
                  }
                ]
              );
              return;
            }
          } catch (error) {
            handleAuthError(error);
            setErrorMessage(error.message);
          }
        },
        register: async (email, password, name, phone) => {
          if (!email || !password || !name) {
            Alert.alert('Missing Information', 'All fields are required to create your account.', [{ text: 'OK' }]);
            return;
          }
          try {
            const userCredential = await auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await user.sendEmailVerification();
            await firestore().collection('users').doc(user.uid).set({
              name,
              email,
              phone,
              transactions: [],
              verified: false,
              createdAt: firestore.Timestamp.fromDate(new Date()),
              userImg: null,
            });
            await auth().signOut();
            Alert.alert(
              'Account Created Successfully!', 
              `Welcome to TrackaExpense, ${name}!\n\nWe've sent a verification email to ${email}. Please check your inbox (and spam folder) and click the verification link before logging in.\n\nOnce verified, you can start tracking your expenses right away!`, 
              [{ text: 'Got it!' }]
            );
          } catch (error) {
            handleAuthError(error);
            setErrorMessage(error.message);
          }
        },
        logout: async () => {
          try {
            await auth().signOut();
          } catch (error) {
            Alert.alert('Error', 'Failed to log out. Please try again.', [{ text: 'OK' }]);
          }
        },
        forgotPassword: async (email) => {
          if (!email) {
            Alert.alert('Email Required', 'Please enter your email address to reset your password.', [{ text: 'OK' }]);
            return;
          }
          try {
            await auth().sendPasswordResetEmail(email);
            Alert.alert('Password Reset Email Sent', 'Check your inbox for instructions to reset your password.', [{ text: 'OK' }]);
          } catch (error) {
            handleAuthError(error);
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export default AuthProvider;