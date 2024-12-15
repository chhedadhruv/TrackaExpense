import { View, Text, Alert } from 'react-native';
import React, { createContext, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleAuthError = (error) => {
    const errorMessages = {
      'auth/user-not-found': {
        title: 'User not found',
        message: 'Please check your email address',
      },
      'auth/wrong-password': {
        title: 'Wrong password',
        message: 'Please check your password',
      },
      'auth/invalid-email': {
        title: 'Invalid email',
        message: 'Please check your email address',
      },
      'auth/user-disabled': {
        title: 'User disabled',
        message: 'This account has been disabled',
      },
      'auth/too-many-requests': {
        title: 'Too many requests',
        message: 'Please try again later',
      },
      'auth/operation-not-allowed': {
        title: 'Operation not allowed',
        message: 'Please contact support',
      },
      'auth/email-already-in-use': {
        title: 'Email already in use',
        message: 'Please use a different email address',
      },
      'auth/invalid-credential': {
        title: 'Invalid credential',
        message: 'Please check your credentials',
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
        login: async (email, password) => {
          if (!email || !password) {
            Alert.alert('Error', 'Email and password are required.', [{ text: 'OK' }]);
            return;
          }

          try {
            const userCredential = await auth().signInWithEmailAndPassword(email, password);
            const currentUser = userCredential.user;

            // Check if email is verified
            if (!currentUser.emailVerified) {
              // Sign out the user
              await auth().signOut();

              // Alert the user about email verification
              Alert.alert(
                'Email Not Verified', 
                'Please verify your email before logging in. Check your inbox for the verification email.', 
                [{ text: 'OK' }]
              );
              return;
            }
          } catch (error) {
            handleAuthError(error);
            setErrorMessage(error.message);
          }
        },
        register: async (email, password, name, phone, balance) => {
          if (!email || !password || !name || !phone) {
            Alert.alert('Error', 'All fields are required.', [{ text: 'OK' }]);
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
              balance: balance || 0,
              transactions: [],
              verified: false,
              createdAt: firestore.Timestamp.fromDate(new Date()),
              userImg: null,
            });
            
            await auth().signOut();
            Alert.alert('Success', 'Registration successful! Please check your email for verification.', [{ text: 'OK' }]);
          } catch (error) {
            handleAuthError(error);
            setErrorMessage(error.message);
          }
        },
        logout: async () => {
          try {
            await auth().signOut();
          } catch (error) {
            Alert.alert('Error', 'Failed to log out.', [{ text: 'OK' }]);
            console.log(error);
          }
        },
        forgotPassword: async (email) => {
          if (!email) {
            Alert.alert('Error', 'Please enter an email address.', [{ text: 'OK' }]);
            return;
          }

          try {
            await auth().sendPasswordResetEmail(email);
            Alert.alert('Success', 'Password reset email sent.', [{ text: 'OK' }]);
          } catch (error) {
            handleAuthError(error);
            console.log(error);
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;