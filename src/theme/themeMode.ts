import type {ThemeScheme} from './palettes';

/** What the user chose: follow the phone, or force one. */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

/**
 * Light until every screen has been converted to the tokens: with 'system' a phone in dark mode
 * would show a dark shell around light screens. Change this to 'system' when the Phase 3 screens
 * are done (the setting offers all three either way).
 */
export const DEFAULT_THEME_MODE: ThemeMode = 'light';

export const THEME_STORAGE_KEY = 'theme.mode';

/** Reads a stored value; anything unknown falls back to the default mode. */
export const parseThemeMode = (stored: unknown): ThemeMode =>
  stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : DEFAULT_THEME_MODE;

/** The scheme to draw: a forced mode wins, otherwise the system's (light when it is unknown). */
export const resolveScheme = (
  mode: ThemeMode,
  systemScheme: string | null | undefined,
): ThemeScheme => {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return systemScheme === 'dark' ? 'dark' : 'light';
};

/** What to hand to Appearance.setColorScheme: 'auto' removes the override (follow the system). */
export const appearanceOverrideFor = (mode: ThemeMode): ThemeScheme | 'auto' =>
  mode === 'system' ? 'auto' : mode;

const channel = (value: number): number => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const luminance = (hex: string): number => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio between two #RRGGBB colours (1 to 21). */
export const contrastRatio = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
};
