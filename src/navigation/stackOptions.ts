import {useMemo} from 'react';
import type {StackNavigationOptions} from 'expo-router/js-stack';
import {useTheme} from '../theme';

/**
 * Header look shared by every stack in the app (the same as the old ThemedStack): themed
 * background, a hairline border, a centred Kufam title. Each screen sets its own `title`, and
 * the tab roots hide the header with `headerShown: false`.
 */
export const useAppStackOptions = (): StackNavigationOptions => {
  const {colors} = useTheme();
  return useMemo(
    () => ({
      headerShown: true,
      // The root layout already pads the top safe area; without this the stack header adds the
      // status bar height a second time and the header is about twice as tall.
      headerStatusBarHeight: 0,
      headerTitleAlign: 'center',
      headerStyle: {
        backgroundColor: colors.headerBg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        elevation: 2,
        shadowColor: colors.shadow,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      headerTitleStyle: {
        fontFamily: 'Kufam-SemiBoldItalic',
        fontSize: 18,
        color: colors.text,
      },
    }),
    [colors],
  );
};

/** The quieter header of the sign-in screens: no title, no shadow, page-coloured. */
export const useAuthStackOptions = (): StackNavigationOptions => {
  const {colors} = useTheme();
  return useMemo(
    () => ({
      headerStatusBarHeight: 0,
      title: '',
      headerStyle: {
        backgroundColor: colors.background,
        shadowColor: colors.background,
        elevation: 0,
      },
    }),
    [colors],
  );
};
