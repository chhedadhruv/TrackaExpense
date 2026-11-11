import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {Appearance, StyleSheet, View, useColorScheme} from 'react-native';
import {vars} from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {themeVars} from './cssVars';
import {palettes, type ThemeColors, type ThemeScheme} from './palettes';
import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  appearanceOverrideFor,
  parseThemeMode,
  resolveScheme,
  type ThemeMode,
} from './themeMode';

export interface ThemeContextValue {
  /** What the user chose: system, light or dark. */
  mode: ThemeMode;
  /** What is being drawn right now. */
  scheme: ThemeScheme;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

// The default is the light theme so a component rendered outside the provider (an error screen
// above it, a test) still works.
export const ThemeContext = createContext<ThemeContextValue>({
  mode: DEFAULT_THEME_MODE,
  scheme: 'light',
  isDark: false,
  colors: palettes.light,
  setMode: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Holds the theme choice, saves it on the device and tells the OS, so native dialogs, date
 * pickers and the keyboard follow it. Children render once the saved choice is read (a few
 * milliseconds) so the app never flashes the wrong theme.
 */
export const ThemeProvider = ({children}: ThemeProviderProps) => {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [loaded, setLoaded] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(stored => {
        if (active) {
          setModeState(parseThemeMode(stored));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // 'auto' clears the override, so the OS scheme applies again.
  useEffect(() => {
    Appearance.setColorScheme(appearanceOverrideFor(mode));
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme = resolveScheme(mode, systemScheme);
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      scheme,
      isDark: scheme === 'dark',
      colors: palettes[scheme],
      setMode,
    }),
    [mode, scheme, setMode],
  );

  // The palette as CSS variables, so NativeWind classes (bg-surface ...) use the same colours.
  const cssVariables = useMemo(
    () => vars(themeVars(value.colors)),
    [value.colors],
  );

  if (!loaded) {
    return null;
  }
  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.root, cssVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({root: {flex: 1}});

/** Colours and mode for the current theme. */
export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

/**
 * Styles that depend on the theme. Write the screen's styles as a function of the colours and
 * build them with StyleSheet.create inside it:
 *
 *   const createStyles = (colors: ThemeColors) => StyleSheet.create({card: {...}});
 *   const styles = useThemedStyles(createStyles);
 *
 * Define the factory at module level so it is stable; the styles are rebuilt only when the
 * colours change.
 */
export const useThemedStyles = <T,>(factory: (colors: ThemeColors) => T): T => {
  const {colors} = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
};
