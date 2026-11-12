import React, {useContext, useEffect, useMemo, useState} from 'react';
import {
  CommonActions,
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
  type Theme,
} from '@react-navigation/native';
import {useTheme} from '../src/theme';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import {AuthContext} from './AuthProvider';
import {
  getAuth,
  onAuthStateChanged as onFirebaseAuthStateChanged,
} from '@react-native-firebase/auth';
import {
  getInitialNotification,
  getMessaging,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import type {User as FirebaseUser} from '@react-native-firebase/auth';
import {setErrorReportingUser} from '../src/services/ErrorReporter';
import {identifyUser, resetMixpanel} from '../src/services/MixpanelService';
import {loginPush, logoutPush} from '../src/services/PushService';
import {TAB} from './tabNames';

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
      [TAB.home]: {
        screens: {
          Home: 'home',
          AddIncome: 'income/add',
          AddExpense: 'expense/add',
        },
      },
      [TAB.statistic]: {
        screens: {
          Statistic: 'statistic',
        },
      },
      [TAB.split]: {
        screens: {
          Split: 'split',
          Invitations: 'split/invitations',
          SplitGroupDetail: 'split/group/:groupId',
        },
      },
      [TAB.savings]: {
        screens: {
          Savings: 'savings',
        },
      },
    },
  },
  getInitialURL: async (): Promise<string | null> => {
    const message = await getInitialNotification(getMessaging());
    if (message?.data?.url) {
      return message.data.url as string;
    }
    return null;
  },
  subscribe: (listener: (url: string) => void) => {
    const unsub = onNotificationOpenedApp(getMessaging(), message => {
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

  const onAuthStateChanged = (firebaseUser: FirebaseUser | null) => {
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
    const subscriber = onFirebaseAuthStateChanged(
      getAuth(),
      onAuthStateChanged,
    );
    return () => subscriber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {colors, isDark} = useTheme();
  const navigationTheme = useMemo<Theme>(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.expense,
      },
      fonts: DefaultTheme.fonts,
    }),
    [colors, isDark],
  );

  if (initializing) {
    return null;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Routes;
