import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Providers from './navigation';
import { checkAllPermissions } from './utils/Permissions';
import NotificationService from './services/NotificationService';

const App: React.FC = () => {
  useEffect(() => {
    // Request permissions when app starts
    if (Platform.OS === 'android') {
      checkAllPermissions();
    }

    (async () => {
      try {
        await NotificationService.initialize();
        await NotificationService.getFCMToken();
      } catch (e) {
        // Silent error handling
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#F5F5F5" 
        translucent={false}
      />
      <Providers />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});

export default App;
