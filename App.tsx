import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HEADER_BG } from './src/constants/theme';
import codePush from '@revopush/react-native-code-push';
import { REVOPUSH_IOS_DEPLOYMENT_KEY, REVOPUSH_ANDROID_DEPLOYMENT_KEY } from '@env';
import Providers from './navigation';
import NotificationService from './services/NotificationService';
import UpdateService from './services/UpdateService';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize notification service
    (async () => {
      try {
        await NotificationService.initialize();
        await NotificationService.getFCMToken();
      } catch (e) {
        // Silent error handling
      }
    })();

    // Check for store update — runs independently, doesn't block notifications
    (async () => {
      try {
        await UpdateService.checkForUpdate();
      } catch (e) {}
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
        <Providers />
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
