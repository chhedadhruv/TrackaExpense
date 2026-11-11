import React, {useMemo} from 'react';
import Routes from './Routes';
import AuthProvider from './AuthProvider';
import {
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
  type MD3Theme,
} from 'react-native-paper';
import {CurrencyProvider} from '../utils/CurrencyUtil';
import {useTheme} from '../src/theme';

const Providers = () => {
  const {colors, isDark} = useTheme();
  // Paper components (Card, Dialog, ActivityIndicator) read their colours from this theme.
  const paperTheme = useMemo<MD3Theme>(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        onPrimary: colors.onPrimary,
        background: colors.background,
        onBackground: colors.text,
        surface: colors.surface,
        onSurface: colors.text,
        surfaceVariant: colors.surfaceMuted,
        onSurfaceVariant: colors.textSecondary,
        outline: colors.border,
        outlineVariant: colors.cardBorder,
      },
    };
  }, [colors, isDark]);

  return (
    <AuthProvider>
      <CurrencyProvider>
        <PaperProvider theme={paperTheme}>
          <Routes />
        </PaperProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
};

export default Providers;
