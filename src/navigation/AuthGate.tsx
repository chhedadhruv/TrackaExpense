import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
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
import DataSync from '../data/DataSync';
import {clearCachedData} from '../data/queryClient';
import {useSyncStore} from '../data/syncStore';
import appUpdate from '../services/AppUpdate';
import {applyUpdateWithin} from '../utils/otaUpdate';
import UpdatePrompt from '../components/UpdatePrompt';

// How long to stay on the splash screen after asking for the restart into an update.
const RESTART_GRACE_MS = 3000;

/**
 * Follows the Firebase sign-in state and shows only the group of screens that fits it: the app
 * when signed in, the sign-in screens otherwise. The native splash screen stays up until the
 * first answer from Firebase (and, with nobody signed in, until the update check is done), so
 * nothing flashes.
 */
const AuthGate = () => {
  const {user, setUser} = useContext(AuthContext);
  const [initializing, setInitializing] = useState(true);
  const [updateSettled, setUpdateSettled] = useState(false);
  const updateCheckStarted = useRef(false);
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

  // Over-the-air update at launch (src/utils/otaUpdate.ts). With nobody signed in the splash
  // screen stays up while the update is fetched, for at most five seconds, and the app restarts
  // into it. A signed-in person is never kept waiting: they get the sheet from UpdatePrompt once
  // the update is downloaded. Decided once, on the first answer from Firebase; signing out later
  // in the same session does not hold the screen again.
  useEffect(() => {
    if (initializing || updateCheckStarted.current) {
      return;
    }
    updateCheckStarted.current = true;
    if (user !== null) {
      setUpdateSettled(true);
      return;
    }
    applyUpdateWithin(appUpdate).then(outcome => {
      if (outcome === 'applied') {
        // The app is restarting. If the restart does not happen, do not stay on the splash.
        setTimeout(() => setUpdateSettled(true), RESTART_GRACE_MS);
        return;
      }
      setUpdateSettled(true);
    });
  }, [initializing, user]);

  const ready = !initializing && updateSettled;
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Nobody is signed in: drop the cached data, in memory and on disk, so the next person to sign
  // in on this phone never sees it (also clears a copy left by a session that ended abruptly).
  useEffect(() => {
    if (!initializing && user === null) {
      clearCachedData();
      useSyncStore.getState().reset();
    }
  }, [initializing, user]);

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

  if (!ready) {
    return null;
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      {user ? <DataSync uid={user.uid} /> : null}
      {user ? <UpdatePrompt /> : null}
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
