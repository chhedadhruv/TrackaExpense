import React, {useContext, useEffect, useMemo, useState} from 'react';
import {Stack, useRootNavigationState} from 'expo-router';
import {
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme,
} from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import {
  getAuth,
  onAuthStateChanged as onFirebaseAuthStateChanged,
} from '@react-native-firebase/auth';
import type {User as FirebaseUser} from '@react-native-firebase/auth';
import {
  getInitialNotification,
  getMessaging,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import {AuthContext} from '../../navigation/AuthProvider';
import {useTheme} from '../theme';
import {setErrorReportingUser} from '../services/ErrorReporter';
import {identifyUser, resetMixpanel} from '../services/MixpanelService';
import {loginPush, logoutPush} from '../services/PushService';
import {markNavigationReady, openPath, pathFromLink} from './openPath';

/**
 * Follows the Firebase sign-in state and shows only the group of screens that fits it: the app
 * when signed in, the sign-in screens otherwise. The native splash screen stays up until the
 * first answer from Firebase, so nothing flashes.
 */
const AuthGate = () => {
  const {user, setUser} = useContext(AuthContext);
  const [initializing, setInitializing] = useState(true);
  const {colors, isDark} = useTheme();

  useEffect(() => {
    const subscriber = onFirebaseAuthStateChanged(
      getAuth(),
      (firebaseUser: FirebaseUser | null) => {
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
        setInitializing(false);
      },
    );
    return () => subscriber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [initializing]);

  // A push whose data carries a link ("trackaexpense://split/invitations"): open it when the app
  // starts from the push and when the push is tapped while the app is in the background.
  useEffect(() => {
    getInitialNotification(getMessaging())
      .then(message => {
        const url = message?.data?.url;
        if (typeof url === 'string') {
          openPath(pathFromLink(url));
        }
      })
      .catch(() => {});
    return onNotificationOpenedApp(getMessaging(), message => {
      const url = message?.data?.url;
      if (typeof url === 'string') {
        openPath(pathFromLink(url));
      }
    });
  }, []);

  const rootState = useRootNavigationState();
  const navigationReady = Boolean(rootState?.key);
  useEffect(() => {
    if (navigationReady) {
      markNavigationReady();
    }
  }, [navigationReady]);

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
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{headerShown: false}}>
        <Stack.Protected guard={user !== null}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={user === null}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
};

export default AuthGate;
