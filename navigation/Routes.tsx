import React, {useContext, useEffect, useState} from 'react';
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import {AuthContext} from './AuthProvider';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';

export const navigationRef = React.createRef<NavigationContainerRef<any>>();

export function navigate(name: string, params?: object): void {
  if (navigationRef.current) {
    navigationRef.current.navigate(name as never, params as never);
  }
}

export function getCurrentRoute(): string | undefined {
  if (navigationRef.current) {
    return navigationRef.current.getCurrentRoute()?.name;
  }
  return undefined;
}

const linking = {
  prefixes: ['trackaexpense://'],
  config: {
    screens: {
      Home: {
        screens: {
          Home: 'home',
          AddIncome: 'income/add',
          AddExpense: 'expense/add',
        },
      },
      Statistic: {
        screens: {
          Statistic: 'statistic',
        },
      },
      Split: {
        screens: {
          Split: 'split',
          Invitations: 'split/invitations',
          SplitGroupDetail: 'split/group/:groupId',
        },
      },
      Savings: {
        screens: {
          Savings: 'savings',
        },
      },
    },
  },
  getInitialURL: async (): Promise<string | null> => {
    const message = await messaging().getInitialNotification();
    if (message?.data?.url) return message.data.url as string;
    return null;
  },
  subscribe: (listener: (url: string) => void) => {
    const unsub = messaging().onNotificationOpenedApp(message => {
      if (message?.data?.url) listener(message.data.url as string);
    });
    return unsub;
  },
};

const Routes = () => {
  const {user, setUser} = useContext(AuthContext);
  const [initializing, setInitializing] = useState(true);

  const onAuthStateChanged = (firebaseUser: FirebaseAuthTypes.User | null) => {
    setUser(firebaseUser);
    if (initializing) setInitializing(false);
  };

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return () => subscriber();
  }, []);

  if (initializing) return null;

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Routes;
