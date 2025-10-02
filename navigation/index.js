import React from 'react';
import Routes from './Routes';
import AuthProvider from './AuthProvider';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Providers = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PaperProvider>
          <Routes />
        </PaperProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default Providers;
