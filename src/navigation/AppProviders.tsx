import React from 'react';
import AuthProvider from '../../navigation/AuthProvider';
import {CurrencyProvider} from '../../utils/CurrencyUtil';

/** Sign-in state and the currency, for everything under the router. */
const AppProviders = ({children}: {children: React.ReactNode}) => (
  <AuthProvider>
    <CurrencyProvider>{children}</CurrencyProvider>
  </AuthProvider>
);

export default AppProviders;
