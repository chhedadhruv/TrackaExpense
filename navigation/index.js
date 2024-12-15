import React from 'react';
import Routes from './Routes';
import AuthProvider from './AuthProvider';
import { Provider as PaperProvider } from 'react-native-paper';

const Providers = () => {
  return (
    <AuthProvider>
      <PaperProvider>
        <Routes />
      </PaperProvider>
    </AuthProvider>
  );
};

export default Providers;
