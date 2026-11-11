import {describe, expect, it} from '@jest/globals';
import {ONBOARDING_PAGES} from '../src/constants/onboardingContent';

// Pictographs, dingbats and the variation selector: the app has a no-emoji rule.
const EMOJI = /[←-⯿\u{1F000}-\u{1FFFF}️]/u;

describe('onboarding content', () => {
  it('has the three pages in order', () => {
    expect(ONBOARDING_PAGES.map(page => page.illustration)).toEqual([
      'track',
      'split',
      'save',
    ]);
  });

  it('uses unique titles (the screen uses them as list keys)', () => {
    const titles = ONBOARDING_PAGES.map(page => page.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('has text for every field', () => {
    for (const page of ONBOARDING_PAGES) {
      expect(page.title.trim().length).toBeGreaterThan(0);
      expect(page.subtitle.trim().length).toBeGreaterThan(0);
      expect(page.imageLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no emoji and no hard-coded currency symbol', () => {
    for (const page of ONBOARDING_PAGES) {
      const text = `${page.title} ${page.subtitle} ${page.imageLabel}`;
      expect(EMOJI.test(text)).toBe(false);
      expect(text).not.toMatch(/[$€£¥₹]/);
    }
  });

  it('keeps titles short enough for two lines on a small phone', () => {
    for (const page of ONBOARDING_PAGES) {
      expect(page.title.length).toBeLessThanOrEqual(40);
      expect(page.subtitle.length).toBeLessThanOrEqual(110);
    }
  });
});
