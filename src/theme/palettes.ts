/**
 * Semantic colour tokens for the light and dark themes. Screens read these through useTheme()
 * (src/theme) instead of the fixed constants in src/constants/theme.ts, which stay for screens not
 * converted yet and equal the light palette.
 *
 * Rules for choosing a token:
 * - Fills of buttons and badges use primaryFill with onPrimary text. Text, icons and borders that
 *   are brand-coloured use primary, which is lighter in dark mode so it stays readable.
 * - Card and sheet backgrounds use surface, the page uses background.
 * - Contrast is enforced in __tests__/themeContrast.test.ts.
 */

export type ThemeScheme = 'light' | 'dark';

export interface ThemeColors {
  /** Page background. */
  background: string;
  /** Cards, sheets, modals, the tab bar. */
  surface: string;
  /** Inset areas on a card: inputs, chips, secondary rows. */
  surfaceMuted: string;
  border: string;
  cardBorder: string;
  /** Thin lines between rows inside a card. */
  divider: string;
  /** Stack header background. */
  headerBg: string;
  /** Dimmed layer behind modals. */
  overlay: string;

  text: string;
  /** Headings and the strongest text. */
  textStrong: string;
  textSecondary: string;
  textMuted: string;
  textPlaceholder: string;
  /** Soft icon colour for empty states and disabled icons. */
  iconMuted: string;

  /** Brand colour for text, icons, borders and active states. */
  primary: string;
  /** Brand colour for fills (buttons, badges); pair with onPrimary. */
  primaryFill: string;
  /** Faint brand tint for icon circles and selected rows. */
  primarySoft: string;
  onPrimary: string;

  income: string;
  expense: string;
  /** Button and badge fills for income and expense; pair with onPrimary text. */
  incomeFill: string;
  expenseFill: string;
  success: string;
  warning: string;
  /** Text on a warning-tinted background (darker amber in light mode). */
  warningText: string;

  shadow: string;
  snackbarBackground: string;
  snackbarBorder: string;
  snackbarText: string;
}

export const lightColors: ThemeColors = {
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6FA',
  border: '#E0E0E0',
  cardBorder: '#E8EBF7',
  divider: '#F0F0F0',
  headerBg: '#F5F5F5',
  overlay: 'rgba(0, 0, 0, 0.5)',

  text: '#333333',
  textStrong: '#2C2C2C',
  textSecondary: '#666666',
  textMuted: '#888888',
  textPlaceholder: '#999999',
  iconMuted: '#CBD3EE',

  primary: '#677CD2',
  primaryFill: '#677CD2',
  primarySoft: 'rgba(103, 124, 210, 0.1)',
  onPrimary: '#FFFFFF',

  income: '#25B07F',
  expense: '#F64E4E',
  incomeFill: '#25B07F',
  expenseFill: '#F64E4E',
  success: '#25B07F',
  warning: '#F5A623',
  warningText: '#E65100',

  shadow: '#000000',
  snackbarBackground: '#2C2C2C',
  snackbarBorder: '#2C2C2C',
  snackbarText: '#FFFFFF',
};

/** Neutral charcoal, chosen by the owner. */
export const darkColors: ThemeColors = {
  background: '#121316',
  surface: '#1C1E22',
  surfaceMuted: '#24272C',
  border: '#2B2E33',
  cardBorder: '#2B2E33',
  divider: '#26292E',
  headerBg: '#16181B',
  overlay: 'rgba(0, 0, 0, 0.7)',

  text: '#ECEDEF',
  textStrong: '#F5F5F6',
  textSecondary: '#B4B7BD',
  textMuted: '#8B8F96',
  textPlaceholder: '#7A7E85',
  iconMuted: '#454A57',

  primary: '#8EA0E6',
  primaryFill: '#677CD2',
  primarySoft: 'rgba(142, 160, 230, 0.16)',
  onPrimary: '#FFFFFF',

  income: '#34C28F',
  expense: '#FF6B6B',
  incomeFill: '#1E9970',
  expenseFill: '#E0484B',
  success: '#34C28F',
  warning: '#F5A623',
  warningText: '#F5A623',

  shadow: '#000000',
  snackbarBackground: '#2F3238',
  snackbarBorder: '#3A3E45',
  snackbarText: '#ECEDEF',
};

export const palettes: Record<ThemeScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
