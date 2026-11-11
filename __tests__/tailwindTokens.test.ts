import {describe, expect, it} from '@jest/globals';
import {darkColors, lightColors} from '../src/theme/palettes';
import {cssVarName, themeVars, tokenClassName} from '../src/theme/cssVars';

const tailwindConfig = require('../tailwind.config.js');

const configColors: Record<string, string> = tailwindConfig.theme.extend.colors;

describe('cssVars', () => {
  it('spells tokens the way Tailwind does', () => {
    expect(tokenClassName('surface')).toBe('surface');
    expect(tokenClassName('surfaceMuted')).toBe('surface-muted');
    expect(tokenClassName('onPrimary')).toBe('on-primary');
    expect(cssVarName('snackbarBackground')).toBe(
      '--color-snackbar-background',
    );
  });

  it('turns a palette into one variable per token', () => {
    const vars = themeVars(lightColors);
    expect(Object.keys(vars)).toHaveLength(Object.keys(lightColors).length);
    expect(vars['--color-background']).toBe(lightColors.background);
    expect(vars['--color-primary-fill']).toBe(lightColors.primaryFill);
    expect(themeVars(darkColors)['--color-background']).toBe(
      darkColors.background,
    );
  });
});

describe('tailwind.config.js stays in step with the palette', () => {
  const expectedNames = Object.keys(lightColors).map(tokenClassName).sort();

  it('has a colour class for every token and nothing else', () => {
    expect(Object.keys(configColors).sort()).toEqual(expectedNames);
  });

  it('points each class at the variable ThemeProvider sets', () => {
    for (const [name, value] of Object.entries(configColors)) {
      expect(value).toBe(`var(--color-${name})`);
    }
    const variables = Object.keys(themeVars(darkColors));
    for (const name of Object.keys(configColors)) {
      expect(variables).toContain(`--color-${name}`);
    }
  });
});
