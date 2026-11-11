/**
 * Tailwind configuration for NativeWind.
 *
 * Colours are not hard-coded here. Every semantic token in src/theme/palettes.ts has a class
 * (bg-surface, text-text-secondary, border-card-border ...) that points at a CSS variable, and
 * ThemeProvider sets those variables from the active palette (src/theme/cssVars.ts). So the
 * palette stays the single source for light and dark, and a class follows the user's theme
 * setting without a dark: variant.
 *
 * The list of names must match the keys of ThemeColors; __tests__/tailwindTokens.test.ts fails
 * when they drift.
 */
const TOKENS = [
  'background',
  'surface',
  'surface-muted',
  'border',
  'card-border',
  'divider',
  'header-bg',
  'overlay',
  'text',
  'text-strong',
  'text-secondary',
  'text-muted',
  'text-placeholder',
  'icon-muted',
  'primary',
  'primary-fill',
  'primary-soft',
  'on-primary',
  'income',
  'expense',
  'income-fill',
  'expense-fill',
  'success',
  'warning',
  'warning-text',
  'expense-soft',
  'income-soft',
  'warning-soft',
  'expense-text',
  'income-text',
  'inverse',
  'on-inverse',
  'shadow',
  'snackbar-background',
  'snackbar-border',
  'snackbar-text',
];

const colors = Object.fromEntries(
  TOKENS.map(name => [name, `var(--color-${name})`]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './navigation/**/*.{ts,tsx}',
    './screens/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  // Follows the OS scheme, which ThemeProvider overrides with Appearance.setColorScheme.
  darkMode: 'media',
  theme: {
    extend: {
      colors,
      // font-sans, font-sans-bold and font-heading. (A family called "bold" would clash with the
      // font-bold weight class.)
      fontFamily: {
        sans: ['Lato-Regular'],
        'sans-bold': ['Lato-Bold'],
        heading: ['Kufam-SemiBoldItalic'],
      },
    },
  },
  plugins: [],
};
