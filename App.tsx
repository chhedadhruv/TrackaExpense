import React, { useEffect } from 'react';
import { Platform } from 'react-native';
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

  return <Providers />;
};

export default App;
