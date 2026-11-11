// Typography and spacing for the app. Screens read colours from the theme tokens in `src/theme`
// (useTheme, which follows light and dark); the colour constants below are the light palette's
// values kept for the few places that still need a fixed colour.

export const PRIMARY_COLOR = '#677CD2';
export const BACKGROUND_COLOR = '#F4F6FA';
export const INCOME_COLOR = '#1E9A6D';
export const EXPENSE_COLOR = '#F64E4E';
export const SUCCESS_COLOR = '#1E9A6D';
export const ORANGE_COLOR = '#C77700';
export const TEXT_PRIMARY = '#333333';
export const TEXT_SECONDARY = '#666666';
export const TEXT_DARK = '#2C2C2C';
export const TEXT_MUTED = '#888888';
export const TEXT_PLACEHOLDER = '#999999';
export const BORDER_COLOR = '#E0E0E0';
export const CARD_BORDER = '#E8EBF7';
export const SURFACE_COLOR = '#F4F6FA';
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';
export const HEADER_BG = '#F5F5F5';

export const FONT = {
  regular: 'Lato-Regular',
  bold: 'Lato-Bold',
  heading: 'Kufam-SemiBoldItalic',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
