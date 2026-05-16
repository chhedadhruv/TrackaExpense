import React from 'react';
import Routes from './Routes';
import AuthProvider from './AuthProvider';
import {Provider as PaperProvider} from 'react-native-paper';
import {CurrencyProvider} from '../utils/CurrencyUtil';

const Providers = () => {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <PaperProvider>
          <Routes />
        </PaperProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
};

export default Providers;
