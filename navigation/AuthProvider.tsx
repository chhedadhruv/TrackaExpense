import {Alert} from 'react-native';
import React, {createContext, useState} from 'react';
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as signOutOfFirebase,
} from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  getCrashlytics,
  setAttribute,
  setUserId,
} from '@react-native-firebase/crashlytics';
import {reportError} from '../src/services/ErrorReporter';
import * as AnalyticsService from '../src/services/AnalyticsService';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';

interface AuthContextValue {
  user: FirebaseAuthTypes.User | null;
  setUser: React.Dispatch<React.SetStateAction<FirebaseAuthTypes.User | null>>;
  validateUserData: (user: FirebaseAuthTypes.User) => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    phone: string,
    currency?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>(
  {} as AuthContextValue,
);

const AuthProvider = ({children}: {children: React.ReactNode}) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [, setErrorMessage] = useState<string | null>(null);

  const validateUserData = async (
    firebaseUser: FirebaseAuthTypes.User,
  ): Promise<boolean> => {
    if (!firebaseUser?.uid) {
      return false;
    }
    try {
      const userDoc = await firestore()
        .collection('users')
        .doc(firebaseUser.uid)
        .get();
      return userDoc.exists;
    } catch (error) {
      reportError(error as Error);
      return false;
    }
  };

  const handleAuthError = (error: {code?: string; message: string}): void => {
    const errorMessages: Record<string, {title: string; message: string}> = {
      'auth/user-not-found': {
        title: 'Account Not Found',
        message:
          'No account found with this email address. Please check your email or sign up for a new account.',
      },
      'auth/wrong-password': {
        title: 'Incorrect Password',
        message:
          'The password you entered is incorrect. Please try again or reset your password.',
      },
      'auth/invalid-email': {
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
      },
      'auth/user-disabled': {
        title: 'Account Disabled',
        message:
          'This account has been disabled. Please contact support for assistance.',
      },
      'auth/too-many-requests': {
        title: 'Too Many Attempts',
        message:
          'Too many unsuccessful login attempts. Please wait a moment and try again.',
      },
      'auth/operation-not-allowed': {
        title: 'Operation Not Allowed',
        message: 'This sign-in method is not enabled. Please contact support.',
      },
      'auth/email-already-in-use': {
        title: 'Email Already Registered',
        message:
          'An account with this email already exists. Please use a different email or try logging in.',
      },
      'auth/invalid-credential': {
        title: 'Login Failed',
        message:
          'Invalid email or password. Please check your credentials and try again.',
      },
    };
    const alertData = error.code ? errorMessages[error.code] : undefined;
    if (alertData) {
      Alert.alert(alertData.title, alertData.message, [{text: 'OK'}]);
    } else {
      Alert.alert('Error', error.message, [{text: 'OK'}]);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        validateUserData,
        login: async (email: string, password: string) => {
          if (!email || !password) {
            Alert.alert(
              'Missing Information',
              'Please enter both email and password.',
              [{text: 'OK'}],
            );
            return;
          }
          try {
            const userCredential = await signInWithEmailAndPassword(
              getAuth(),
              email,
              password,
            );
            const currentUser = userCredential.user;
            setUserId(getCrashlytics(), currentUser.uid);
            setAttribute(getCrashlytics(), 'auth_method', 'email');
            AnalyticsService.logLogin('email');
            if (!currentUser.emailVerified) {
              await signOutOfFirebase(getAuth());
              Alert.alert(
                'Email Verification Required',
                "Please verify your email address before logging in. Check your inbox (and spam folder) for the verification email we sent when you signed up.\n\nDidn't receive the email? You can request a new one from the signup screen.",
                [
                  {text: 'OK'},
                  {
                    text: 'Resend Email',
                    onPress: async () => {
                      try {
                        const tempUser = await signInWithEmailAndPassword(
                          getAuth(),
                          email,
                          password,
                        );
                        await sendEmailVerification(tempUser.user);
                        await signOutOfFirebase(getAuth());
                        Alert.alert(
                          'Verification Email Sent',
                          'A new verification email has been sent to your inbox.',
                          [{text: 'OK'}],
                        );
                      } catch (_) {
                        Alert.alert(
                          'Error',
                          'Failed to send verification email. Please try again later.',
                          [{text: 'OK'}],
                        );
                      }
                    },
                  },
                ],
              );
              return;
            }
          } catch (error) {
            handleAuthError(error as {code?: string; message: string});
            setErrorMessage((error as Error).message);
          }
        },
        register: async (
          email: string,
          password: string,
          name: string,
          phone: string,
          currency = 'INR',
        ) => {
          if (!email || !password || !name) {
            Alert.alert(
              'Missing Information',
              'All fields are required to create your account.',
              [{text: 'OK'}],
            );
            return;
          }
          try {
            const userCredential = await createUserWithEmailAndPassword(
              getAuth(),
              email,
              password,
            );
            const newUser = userCredential.user;
            await sendEmailVerification(newUser);
            await firestore()
              .collection('users')
              .doc(newUser.uid)
              .set({
                name,
                email,
                phone,
                currency,
                transactions: [],
                verified: false,
                createdAt: firestore.Timestamp.fromDate(new Date()),
                userImg: null,
                balance: 0,
              });
            setUserId(getCrashlytics(), newUser.uid);
            setAttribute(getCrashlytics(), 'auth_method', 'email');
            AnalyticsService.logSignUp('email', currency);
            await signOutOfFirebase(getAuth());
            Alert.alert(
              'Account Created Successfully!',
              `Welcome to TrackaExpense, ${name}!\n\nWe've sent a verification email to ${email}. Please check your inbox (and spam folder) and click the verification link before logging in.\n\nOnce verified, you can start tracking your expenses right away!`,
              [{text: 'Got it!'}],
            );
          } catch (error) {
            handleAuthError(error as {code?: string; message: string});
            setErrorMessage((error as Error).message);
          }
        },
        logout: async () => {
          try {
            await signOutOfFirebase(getAuth());
            setUserId(getCrashlytics(), '');
          } catch (_) {
            Alert.alert('Error', 'Failed to log out. Please try again.', [
              {text: 'OK'},
            ]);
          }
        },
        forgotPassword: async (email: string) => {
          if (!email) {
            Alert.alert(
              'Email Required',
              'Please enter your email address to reset your password.',
              [{text: 'OK'}],
            );
            return;
          }
          try {
            await sendPasswordResetEmail(getAuth(), email);
            AnalyticsService.logPasswordResetRequested();
            Alert.alert(
              'Password Reset Email Sent',
              'Check your inbox for instructions to reset your password.',
              [{text: 'OK'}],
            );
          } catch (error) {
            handleAuthError(error as {code?: string; message: string});
          }
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
