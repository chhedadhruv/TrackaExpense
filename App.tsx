import React, {useEffect, useState} from 'react';
import {Platform, StatusBar, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {HEADER_BG} from './src/constants/theme';
import codePush from '@revopush/react-native-code-push';
import {
  REVOPUSH_IOS_DEPLOYMENT_KEY,
  REVOPUSH_ANDROID_DEPLOYMENT_KEY,
} from '@env';
import crashlytics from '@react-native-firebase/crashlytics';
import Providers from './navigation';
import NotificationService from './services/NotificationService';
import UpdateService from './services/UpdateService';
import ErrorBoundary from './components/ErrorBoundary';
import DeviceInfo from 'react-native-device-info';
import ForceUpdateScreen from './components/ForceUpdateScreen';
import {getConfig, initRemoteConfig} from './src/services/RemoteConfigService';
import {isVersionBelow} from './src/utils/version';

const App: React.FC = () => {
  const [forceUpdateMessage, setForceUpdateMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Initialize notification service
    (async () => {
      try {
        await NotificationService.initialize();
        await NotificationService.getFCMToken();
      } catch (e) {
        crashlytics().recordError(e as Error);
      }
    })();

    // Check for store update — runs independently, doesn't block notifications
    (async () => {
      try {
        await UpdateService.checkForUpdate();
      } catch (e) {
        crashlytics().recordError(e as Error);
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
        crashlytics().recordError(e as Error);
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
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
})(App);
