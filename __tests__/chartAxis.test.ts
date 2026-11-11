import {describe, expect, it} from '@jest/globals';
import {compactAxisLabel, niceAxisMax} from '../src/utils/chartAxis';

describe('niceAxisMax', () => {
  it('rounds up to a clean value that covers the data', () => {
    expect(niceAxisMax(3000, 3)).toBe(3000);
    expect(niceAxisMax(3100, 3)).toBe(4500);
    expect(niceAxisMax(870, 3)).toBe(900);
    expect(niceAxisMax(120000, 3)).toBeGreaterThanOrEqual(120000);
  });

  it('always covers the largest value', () => {
    for (const v of [1, 7, 99, 101, 2499, 12345, 987654, 5e7]) {
      expect(niceAxisMax(v, 3)).toBeGreaterThanOrEqual(v);
    }
  });

  it('gives whole-number sections for whole-number data', () => {
    for (const v of [10, 450, 3333, 98765]) {
      const max = niceAxisMax(v, 3);
      expect(Number.isFinite(max)).toBe(true);
      expect((max / 3) * 3).toBe(max);
    }
  });

  it('falls back to a usable axis with no data', () => {
    expect(niceAxisMax(0, 3)).toBe(3);
    expect(niceAxisMax(-Infinity, 3)).toBe(3);
    expect(niceAxisMax(NaN, 3)).toBe(3);
  });
});

describe('compactAxisLabel', () => {
  it('shortens thousands, millions and billions', () => {
    expect(compactAxisLabel(0, '₹')).toBe('₹0');
    expect(compactAxisLabel(950, '₹')).toBe('₹950');
    expect(compactAxisLabel(1200, '$')).toBe('$1.2K');
    expect(compactAxisLabel(25000, '₹')).toBe('₹25K');
    expect(compactAxisLabel(3400000, '€')).toBe('€3.4M');
    expect(compactAxisLabel(2e9, '$')).toBe('$2B');
  });

  it('keeps the sign', () => {
    expect(compactAxisLabel(-1500, '$')).toBe('-$1.5K');
  });
});
