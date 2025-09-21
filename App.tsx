import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Providers from './navigation';
import { checkAllPermissions } from './utils/Permissions';

const App: React.FC = () => {
  useEffect(() => {
    // Request permissions when app starts
    if (Platform.OS === 'android') {
      checkAllPermissions();
    }
  }, []);

  return <Providers />;
};

export default App;
