import type {ThemeColors} from './palettes';

const kebab = (key: string): string =>
  key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** Token name as Tailwind spells it: surfaceMuted becomes surface-muted. */
export const tokenClassName = (key: string): string => kebab(key);

/** The CSS variable that holds a token: surfaceMuted becomes --color-surface-muted. */
export const cssVarName = (key: string): string => `--color-${kebab(key)}`;

/**
 * The variables for a palette, ready for NativeWind's vars(). ThemeProvider sets them on a root
 * view, tailwind.config.js points its colour classes at them (bg-surface and so on).
 */
export const themeVars = (colors: ThemeColors): Record<string, string> =>
  Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [cssVarName(key), value]),
  );
