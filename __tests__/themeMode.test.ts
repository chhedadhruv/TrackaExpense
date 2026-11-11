import {describe, expect, it} from '@jest/globals';
import {
  DEFAULT_THEME_MODE,
  appearanceOverrideFor,
  contrastRatio,
  parseThemeMode,
  resolveScheme,
} from '../src/theme/themeMode';

describe('parseThemeMode', () => {
  it('accepts the three modes', () => {
    expect(parseThemeMode('system')).toBe('system');
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode('dark')).toBe('dark');
  });

  it('falls back to the default mode for anything else', () => {
    expect(parseThemeMode(null)).toBe(DEFAULT_THEME_MODE);
    expect(parseThemeMode(undefined)).toBe(DEFAULT_THEME_MODE);
    expect(parseThemeMode('')).toBe(DEFAULT_THEME_MODE);
    expect(parseThemeMode('sepia')).toBe(DEFAULT_THEME_MODE);
    expect(parseThemeMode(1)).toBe(DEFAULT_THEME_MODE);
  });

  it('follows the phone until the user picks a mode', () => {
    expect(DEFAULT_THEME_MODE).toBe('system');
  });
});

describe('resolveScheme', () => {
  it('a forced mode ignores the system scheme', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('dark', null)).toBe('dark');
  });

  it('system follows the phone', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  it('system is light when the phone does not say', () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
    expect(resolveScheme('system', 'unspecified')).toBe('light');
  });
});

describe('appearanceOverrideFor', () => {
  it('clears the override for system and forces the others', () => {
    expect(appearanceOverrideFor('system')).toBe('auto');
    expect(appearanceOverrideFor('light')).toBe('light');
    expect(appearanceOverrideFor('dark')).toBe('dark');
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#FEDCBA')).toBeCloseTo(
      contrastRatio('#FEDCBA', '#123456'),
      10,
    );
  });
});
