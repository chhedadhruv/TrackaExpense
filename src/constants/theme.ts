// Single source of truth for all app colors and typography.
// Every screen must import from here — never redeclare these constants inline.

export const PRIMARY_COLOR = '#677CD2';
export const BACKGROUND_COLOR = '#F4F6FA';
export const INCOME_COLOR = '#25B07F';
export const EXPENSE_COLOR = '#F64E4E';
export const SUCCESS_COLOR = '#25B07F';
export const ORANGE_COLOR = '#F5A623';
export const TEXT_PRIMARY = '#333333';
export const TEXT_SECONDARY = '#666666';
export const BORDER_COLOR = '#E0E0E0';
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';

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
