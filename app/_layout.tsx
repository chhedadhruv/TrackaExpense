import '../global.css';
import React, {useEffect, useState} from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import * as Application from 'expo-application';
import * as SplashScreen from 'expo-splash-screen';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {ThemeProvider, useTheme} from '../src/theme';
import {
  initErrorReporting,
  reportError,
  wrapWithErrorReporting,
} from '../src/services/ErrorReporter';
import {initMixpanel} from '../src/services/MixpanelService';
import {initPush} from '../src/services/PushService';
import NotificationService from '../services/NotificationService';
import {handleNotificationNavigation} from '../services/NotificationNavigation';
import UpdateService from '../services/UpdateService';
import ErrorBoundary from '../components/ErrorBoundary';
import ForceUpdateScreen from '../components/ForceUpdateScreen';
import {SnackbarHost} from '../src/components/Snackbar';
import {getConfig, initRemoteConfig} from '../src/services/RemoteConfigService';
import {isVersionBelow} from '../src/utils/version';
import AppProviders from '../src/navigation/AppProviders';
import AuthGate from '../src/navigation/AuthGate';
import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client';
import {persistOptions, queryClient} from '../src/data/queryClient';

// Start error reporting before anything renders so startup errors are captured, and keep the
// native splash screen up until AuthGate knows whether someone is signed in.
initErrorReporting();
SplashScreen.preventAutoHideAsync().catch(() => {});
const RootLayout = () => {
  const [forceUpdateMessage, setForceUpdateMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Analytics and push start here. Neither asks for any permission on start.
    initMixpanel();
    initPush(handleNotificationNavigation);

    // Initialize notification service
    (async () => {
      try {
        await NotificationService.initialize();
        await NotificationService.getFCMToken();
      } catch (e) {
        reportError(e as Error);
      }
    })();

    // Check for store update. Runs independently, doesn't block notifications.
    (async () => {
      try {
        await UpdateService.checkForUpdate();
      } catch (e) {
        reportError(e as Error);
      }
    })();

    // Initialize Remote Config: fetch and activate values, apply defaults on failure.
    (async () => {
      try {
        await initRemoteConfig();
        // Block versions below the minimum supported version set in Remote Config.
        const config = getConfig();
        if (
          isVersionBelow(
            Application.nativeApplicationVersion ?? '0.0.0',
            config.min_supported_version,
          )
        ) {
          setForceUpdateMessage(config.update_message);
        }
      } catch (e) {
        reportError(e as Error);
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <Shell forceUpdateMessage={forceUpdateMessage} />
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
};

/** The themed frame: status bar area, error boundary, the app and the snackbar layer. */
const Shell = ({forceUpdateMessage}: {forceUpdateMessage: string | null}) => {
  const {colors, isDark} = useTheme();
  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.headerBg}]}
      edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ErrorBoundary>
        {forceUpdateMessage !== null ? (
          <ForceUpdateScreen message={forceUpdateMessage} />
        ) : (
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}>
            <AppProviders>
              <AuthGate />
            </AppProviders>
          </PersistQueryClientProvider>
        )}
      </ErrorBoundary>
      <SnackbarHost />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default wrapWithErrorReporting(RootLayout);
