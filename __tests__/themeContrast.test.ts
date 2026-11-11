import {describe, expect, it} from '@jest/globals';
import {darkColors, lightColors, type ThemeColors} from '../src/theme/palettes';
import {contrastRatio} from '../src/theme/themeMode';

const AA_TEXT = 4.5;
const AA_LARGE = 3;

const surfaces = (c: ThemeColors) =>
  [
    ['background', c.background],
    ['surface', c.surface],
  ] as const;

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s palette contrast', (name, c) => {
  // The light palette is the app's existing brand colours, kept unchanged. Green and amber are
  // below the 3:1 UI guideline on white (green 2.8, amber 2.1), so light mode only has a floor
  // that stops them getting worse; the new dark palette meets the full threshold.
  const greenMin = name === 'light' ? 2.5 : AA_LARGE;
  const amberMin = name === 'light' ? 1.8 : AA_LARGE;

  it.each(surfaces(c))('body text is readable on %s', (_label, bg) => {
    expect(contrastRatio(c.text, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(c.textStrong, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(c.textSecondary, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(surfaces(c))(
    'brand, money and status colours are visible on %s',
    (_label, bg) => {
      // Used for icons, big amounts and accents: the large-text / UI threshold.
      expect(contrastRatio(c.primary, bg)).toBeGreaterThanOrEqual(AA_LARGE);
      expect(contrastRatio(c.income, bg)).toBeGreaterThanOrEqual(greenMin);
      expect(contrastRatio(c.expense, bg)).toBeGreaterThanOrEqual(AA_LARGE);
      expect(contrastRatio(c.success, bg)).toBeGreaterThanOrEqual(greenMin);
      expect(contrastRatio(c.warning, bg)).toBeGreaterThanOrEqual(amberMin);
    },
  );

  it('button text is readable on the button fill', () => {
    // Button labels are bold and large.
    expect(contrastRatio(c.onPrimary, c.primaryFill)).toBeGreaterThanOrEqual(
      AA_LARGE,
    );
  });

  it('income and expense button text is readable on its fill', () => {
    // Light keeps today's brand fills (green is 2.8:1 with white); dark meets the threshold.
    expect(contrastRatio(c.onPrimary, c.incomeFill)).toBeGreaterThanOrEqual(
      greenMin,
    );
    expect(contrastRatio(c.onPrimary, c.expenseFill)).toBeGreaterThanOrEqual(
      AA_LARGE,
    );
  });

  it.each(surfaces(c))(
    'error and success text are readable on %s',
    (_label, bg) => {
      expect(contrastRatio(c.expenseText, bg)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(c.incomeText, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('the inverse button text is readable on its fill', () => {
    expect(contrastRatio(c.onInverse, c.inverse)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('snackbar text and accents are readable on the snackbar', () => {
    expect(
      contrastRatio(c.snackbarText, c.snackbarBackground),
    ).toBeGreaterThanOrEqual(AA_TEXT);
    expect(
      contrastRatio(c.success, c.snackbarBackground),
    ).toBeGreaterThanOrEqual(AA_LARGE);
    expect(
      contrastRatio(c.expense, c.snackbarBackground),
    ).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe('dark palette specifics', () => {
  it('muted text and placeholders stay legible on cards', () => {
    expect(
      contrastRatio(darkColors.textMuted, darkColors.surface),
    ).toBeGreaterThanOrEqual(AA_TEXT);
    expect(
      contrastRatio(darkColors.textPlaceholder, darkColors.surface),
    ).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('income and expense meet the text threshold on cards', () => {
    expect(
      contrastRatio(darkColors.income, darkColors.surface),
    ).toBeGreaterThanOrEqual(AA_TEXT);
    expect(
      contrastRatio(darkColors.expense, darkColors.surface),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('cards are distinguishable from the page', () => {
    expect(
      contrastRatio(darkColors.surface, darkColors.background),
    ).toBeGreaterThan(1.1);
  });
});

describe('both palettes define every token', () => {
  it('have the same keys and no empty values', () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
    for (const value of [
      ...Object.values(lightColors),
      ...Object.values(darkColors),
    ]) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
