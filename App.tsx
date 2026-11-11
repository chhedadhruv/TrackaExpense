import React, {useEffect, useState} from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {HEADER_BG} from './src/constants/theme';
import {
  initErrorReporting,
  reportError,
  wrapWithErrorReporting,
} from './src/services/ErrorReporter';
import {initMixpanel} from './src/services/MixpanelService';
import {initPush} from './src/services/PushService';
import Providers from './navigation';
import NotificationService from './services/NotificationService';
import {handleNotificationNavigation} from './services/NotificationNavigation';
import UpdateService from './services/UpdateService';
import ErrorBoundary from './components/ErrorBoundary';
import * as Application from 'expo-application';
import ForceUpdateScreen from './components/ForceUpdateScreen';
import {SnackbarHost} from './src/components/Snackbar';
import {getConfig, initRemoteConfig} from './src/services/RemoteConfigService';
import {isVersionBelow} from './src/utils/version';

// Start error reporting before anything renders so startup errors are captured.
initErrorReporting();

const App: React.FC = () => {
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

    // Check for store update — runs independently, doesn't block notifications
    (async () => {
      try {
        await UpdateService.checkForUpdate();
      } catch (e) {
        reportError(e as Error);
      }
    })();

    // Initialize Remote Config — fetch and activate values, apply defaults on failure
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
        <SafeAreaView style={styles.container} edges={['top']}>
          <StatusBar barStyle="dark-content" />
          <ErrorBoundary>
            {forceUpdateMessage !== null ? (
              <ForceUpdateScreen message={forceUpdateMessage} />
            ) : (
              <Providers />
            )}
          </ErrorBoundary>
          <SnackbarHost />
        </SafeAreaView>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEADER_BG,
  },
});

export default wrapWithErrorReporting(App);
