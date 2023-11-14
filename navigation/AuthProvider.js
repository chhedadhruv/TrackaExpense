import {View, Text, Alert} from 'react-native';
import React, {createContext, useState} from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

export const AuthContext = createContext();

const AuthProvider = ({children, navigation}) => {
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState();
  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login: async (email, password) => {
          if (!email) {
            alert('Please enter an email address');
            return;
          }
          if (!password) {
            alert('Please enter a password');
            return;
          }
          try {
            await auth().signInWithEmailAndPassword(email, password);
          } catch (e) {
            console.log(e);
            setErrorMessage(e.message);
            if (e.code === 'auth/user-not-found') {
              Alert.alert(
                'User not found',
                'Please check your email address',
                [
                  {
                    text: 'Ok',
                    onPress: () => console.log('Ok pressed'),
                  },
                ],
                {cancelable: false},
              );
            }
            else if (e.code === 'auth/wrong-password') {
              Alert.alert(
                'Wrong password',
                'Please check your password',
                [
                  {
                    text: 'Ok',
                    onPress: () => console.log('Ok pressed'),
                  },
                ],
                {cancelable: false},
              );
            }
            else if (e.code === 'auth/invalid-email') {
              Alert.alert(
                'Invalid email',
                'Please check your email address',
                [
                  {
                    text: 'Ok',
                    onPress: () => console.log('Ok pressed'),
                  },
                ],
                {cancelable: false},
              );
            }
            else if (e.code === 'auth/user-disabled') {
              Alert.alert(
                'User disabled',
                'Please check your email address',
                [
                  {
                    text: 'Ok',
                    onPress: () => console.log('Ok pressed'),
                  },
                ],
                {cancelable: false},
              );
            }
            else if (e.code === 'auth/too-many-requests') {
              Alert.alert(
                'Too many requests',
                'Please check your email address',
                [
                  {
                    text: 'Ok',
                    onPress: () => console.log('Ok pressed'),
                  },
                ],
                {cancelable: false},
              );
            }
            else if (e.code === 'auth/operation-not-allowed') {
              Alert.alert(
                'Operation not allowed',
                'Please check your email address',
                [
                  {
                    text: 'Ok',
                    onPress: () => console.log('Ok pressed'),
                  },
                ],
                {cancelable: false},
              );
            }
            else if (e.code === 'auth/invalid-login') {
              Alert.alert(
                'Account not found',
                'Account not found. Please check your email address',
                [
                  {
                    text: 'Ok',
                    onPress: () => console.log('Ok pressed'),
                  },
                ],
                {cancelable: false},
              );
            }
          }
        },
        googleLogin: async () => {
          try {
            const {idToken} = await GoogleSignin.signIn();
            const googleCredential =
              auth.GoogleAuthProvider.credential(idToken);
            await auth().signInWithCredential(googleCredential);
            firestore()
              .collection('users')
              .doc(auth().currentUser.uid)
              .set({
                name: auth().currentUser.displayName,
                email: auth().currentUser.email,
                balance: '',
                transactions: [],
                verified: true,
                createdAt: firestore.Timestamp.fromDate(new Date()),
                userImg: auth().currentUser.photoURL,
              })
              //ensure we catch any errors at this stage to advise us if something does go wrong
              .catch(error => {
                console.log(
                  'Something went wrong with added user to firestore: ',
                  error,
                );
              })
              //we need to catch the whole sign up process if it fails too.
              .catch(error => {
                console.log('Something went wrong with sign up: ', error);
                setErrorMessage(error.message);
              });
          } catch (error) {
            console.log({error});
          }
        },
        register: async (email, password, name, balance) => {
          if (!email) {
            alert('Please enter an email address');
            return;
          }
          if (!password) {
            alert('Please enter a password');
            return;
          }
          try {
            await auth()
              .createUserWithEmailAndPassword(email, password)
              .then(async () => {
                //Once the user creation has happened successfully, we can add the currentUser into firestore
                //with the appropriate details.
                const user = auth().currentUser;
                await user.sendEmailVerification();
                firestore()
                  .collection('users')
                  .doc(auth().currentUser.uid)
                  .set({
                    name: name,
                    email: email,
                    balance: balance,
                    transactions: [],
                    verified: false,
                    createdAt: firestore.Timestamp.fromDate(new Date()),
                    userImg: null,
                  })

                  // firestore()
                  // .collection('emergencyContacts')
                  // .doc(auth().currentUser.uid)
                  // .set({
                  //   email: email,
                  //   name: '',
                  //   phone: '',
                  //   createdAt: firestore.Timestamp.fromDate(new Date()),
                  // })

                  //ensure we catch any errors at this stage to advise us if something does go wrong
                  .catch(error => {
                    console.log(
                      'Something went wrong with added user to firestore: ',
                      error,
                    );
                  });
                  alert('Registration successful! Please check your email for a verification link.');
              })
              //we need to catch the whole sign up process if it fails too.
              .catch(error => {
                console.log('Something went wrong with sign up: ', error);
                setErrorMessage(error.message);
                if (error.code === 'auth/email-already-in-use') {
                  Alert.alert(
                    'Email already in use',
                    'Please check your email address',
                    [
                      {
                        text: 'Ok',
                        onPress: () => console.log('Ok pressed'),
                      },
                    ],
                    {cancelable: false},
                  );
                }
                else if (error.code === 'auth/invalid-email') {
                  Alert.alert(
                    'Invalid email',
                    'Please check your email address',
                    [
                      {
                        text: 'Ok',
                        onPress: () => console.log('Ok pressed'),
                      },
                    ],
                    {cancelable: false},
                  );
                }
                else if (error.code === 'auth/weak-password') {
                  Alert.alert(
                    'Weak password',
                    'Please check your password',
                    [
                      {
                        text: 'Ok',
                        onPress: () => console.log('Ok pressed'),
                      },
                    ],
                    {cancelable: false},
                  );
                }
              });
          } catch (e) {
            console.log(e);
            // setErrorMessage(e.message);
            // alert(e.message);
          }
        },
        logout: async () => {
          try {
            await auth().signOut();
          } catch (e) {
            console.log(e);
          }
        },
        forgotPassword: async (email) => {
          if (!email) {
            alert('Please enter an email address');
            return;
          }
          try {
            await auth()
              .sendPasswordResetEmail(email)
              .then(() => {
                alert('Password reset email sent!');
              });
          } catch (e) {
            console.log(e);
          }
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;