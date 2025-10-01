import React, { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
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
        const token = await NotificationService.getFCMToken();
        if (token) {
          console.log('FCM token:', token);
        }
      } catch (e) {
        console.log('FCM setup error:', e);
      }
    })();
  }, []);

  return <Providers />;
};

export default App;
