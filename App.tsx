import React, {useEffect, useState} from 'react';
import {Platform, StatusBar, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {HEADER_BG} from './src/constants/theme';
import codePush from '@revopush/react-native-code-push';
import {
  REVOPUSH_IOS_DEPLOYMENT_KEY,
  REVOPUSH_ANDROID_DEPLOYMENT_KEY,
} from '@env';
import {
  initErrorReporting,
  reportError,
  wrapWithErrorReporting,
} from './src/services/ErrorReporter';
import {initMixpanel} from './src/services/MixpanelService';
import {initPush} from './src/services/PushService';
import Providers from './navigation';
import NotificationService from './services/NotificationService';
import UpdateService from './services/UpdateService';
import ErrorBoundary from './components/ErrorBoundary';
import DeviceInfo from 'react-native-device-info';
import ForceUpdateScreen from './components/ForceUpdateScreen';
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
    initPush();

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
          isVersionBelow(DeviceInfo.getVersion(), config.min_supported_version)
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
          <StatusBar
            barStyle="dark-content"
            backgroundColor={HEADER_BG}
            translucent={false}
          />
          <ErrorBoundary>
            {forceUpdateMessage !== null ? (
              <ForceUpdateScreen message={forceUpdateMessage} />
            ) : (
              <Providers />
            )}
          </ErrorBoundary>
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

export default codePush({
  deploymentKey: Platform.select({
    ios: REVOPUSH_IOS_DEPLOYMENT_KEY,
    android: REVOPUSH_ANDROID_DEPLOYMENT_KEY,
  }),
})(wrapWithErrorReporting(App));
