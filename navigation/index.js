import React from 'react';
import Routes from './Routes';
import AuthProvider from './AuthProvider';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CurrencyProvider } from '../utils/CurrencyUtil';

const Providers = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CurrencyProvider>
          <PaperProvider>
            <Routes />
          </PaperProvider>
        </CurrencyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default Providers;
