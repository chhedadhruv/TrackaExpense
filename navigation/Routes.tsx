import React, {useContext, useEffect, useState} from 'react';
import {
  CommonActions,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import {AuthContext} from './AuthProvider';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import analytics from '@react-native-firebase/analytics';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {setErrorReportingUser} from '../src/services/ErrorReporter';
import {identifyUser, resetMixpanel} from '../src/services/MixpanelService';
import {loginPush, logoutPush} from '../src/services/PushService';

export const navigationRef = React.createRef<NavigationContainerRef<any>>();

export function navigate(name: string, params?: object): void {
  if (navigationRef.current) {
    navigationRef.current.dispatch(CommonActions.navigate({name, params}));
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
    if (message?.data?.url) {
      return message.data.url as string;
    }
    return null;
  },
  subscribe: (listener: (url: string) => void) => {
    const unsub = messaging().onNotificationOpenedApp(message => {
      if (message?.data?.url) {
        listener(message.data.url as string);
      }
    });
    return unsub;
  },
};

const Routes = () => {
  const {user, setUser} = useContext(AuthContext);
  const [initializing, setInitializing] = useState(true);

  const onAuthStateChanged = (firebaseUser: FirebaseAuthTypes.User | null) => {
    // Identity for error reporting, analytics and push: uid only, never email or name.
    // Unverified email accounts are signed out again by the login flow, so skip them.
    if (firebaseUser && firebaseUser.emailVerified) {
      setErrorReportingUser(firebaseUser.uid);
      identifyUser(firebaseUser.uid);
      loginPush(firebaseUser.uid);
    } else if (!firebaseUser) {
      setErrorReportingUser(null);
      resetMixpanel();
      logoutPush();
    }
    setUser(firebaseUser);
    if (initializing) {
      setInitializing(false);
    }
  };

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return () => subscriber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initializing) {
    return null;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onStateChange={() => {
        const routeName = navigationRef.current?.getCurrentRoute()?.name;
        if (routeName) {
          analytics()
            .logScreenView({screen_name: routeName, screen_class: routeName})
            .catch(() => {});
        }
      }}>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Routes;
