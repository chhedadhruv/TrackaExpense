import {describe, expect, it} from '@jest/globals';
import {
  allocateMinor,
  fromMinor,
  getCurrencyExponent,
  splitEqually,
  sumMinor,
  toMajorNumber,
  toMinor,
  tryToMinor,
} from '../src/utils/money';

describe('getCurrencyExponent', () => {
  it('uses 2 by default and 0 for JPY and KRW', () => {
    expect(getCurrencyExponent('INR')).toBe(2);
    expect(getCurrencyExponent('usd')).toBe(2);
    expect(getCurrencyExponent('XYZ')).toBe(2);
    expect(getCurrencyExponent('JPY')).toBe(0);
    expect(getCurrencyExponent('KRW')).toBe(0);
  });
});

describe('toMinor', () => {
  it('converts numbers and strings', () => {
    expect(toMinor('123.45', 'INR')).toBe(12345);
    expect(toMinor(123.45, 'INR')).toBe(12345);
    expect(toMinor('100', 'INR')).toBe(10000);
    expect(toMinor('.5', 'INR')).toBe(50);
    expect(toMinor('5.', 'INR')).toBe(500);
    expect(toMinor(0, 'INR')).toBe(0);
  });

  it('rounds the 4-decimal strings found in live data', () => {
    expect(toMinor('123.4567', 'INR')).toBe(12346);
    expect(toMinor('123.4549', 'INR')).toBe(12345);
    expect(toMinor('0.0001', 'INR')).toBe(0);
  });

  it('rounds half away from zero, on the typed decimal text', () => {
    expect(toMinor('0.005', 'INR')).toBe(1);
    expect(toMinor('0.004', 'INR')).toBe(0);
    expect(toMinor('-0.005', 'INR')).toBe(-1);
    expect(toMinor('-0.004', 'INR')).toBe(0);
    // 1.005 is not exactly representable as a float, but the typed text rounds to 1.01.
    expect(toMinor(1.005, 'INR')).toBe(101);
    expect(toMinor('2.675', 'INR')).toBe(268);
  });

  it('is exact where float arithmetic is not', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toMinor(0.1 + 0.2, 'INR')).toBe(30);
    expect(toMinor(0.1, 'INR') + toMinor(0.2, 'INR')).toBe(30);
    expect(toMinor(19.99 * 3, 'INR')).toBe(5997);
  });

  it('handles negatives, signs and thousands separators', () => {
    expect(toMinor('-12.5', 'INR')).toBe(-1250);
    expect(toMinor('+12.5', 'INR')).toBe(1250);
    expect(toMinor('1,234.5', 'INR')).toBe(123450);
    expect(toMinor('  7.1 ', 'INR')).toBe(710);
    expect(toMinor('-0', 'INR')).toBe(0);
    expect(Object.is(toMinor('-0', 'INR'), -0)).toBe(false);
  });

  it('uses the currency exponent', () => {
    expect(toMinor('1234.5', 'JPY')).toBe(1235);
    expect(toMinor('1234.4', 'JPY')).toBe(1234);
    expect(toMinor('1234', 'KRW')).toBe(1234);
  });

  it('handles very small numbers that print in exponent form', () => {
    expect(toMinor(1e-7, 'INR')).toBe(0);
  });

  it('rejects values that are not amounts', () => {
    expect(tryToMinor('', 'INR')).toBeNull();
    expect(tryToMinor('   ', 'INR')).toBeNull();
    expect(tryToMinor('abc', 'INR')).toBeNull();
    expect(tryToMinor('1.2.3', 'INR')).toBeNull();
    expect(tryToMinor('12,5', 'INR')).toBeNull();
    expect(tryToMinor('.', 'INR')).toBeNull();
    expect(tryToMinor('1e5', 'INR')).toBeNull();
    expect(tryToMinor(NaN, 'INR')).toBeNull();
    expect(tryToMinor(Infinity, 'INR')).toBeNull();
    expect(() => toMinor('abc', 'INR')).toThrow(RangeError);
  });

  it('rejects values beyond the safe integer range', () => {
    expect(toMinor('90071992547409.91', 'INR')).toBe(9007199254740991);
    expect(tryToMinor('90071992547409.92', 'INR')).toBeNull();
    expect(tryToMinor(1e21, 'INR')).toBeNull();
  });
});

describe('fromMinor and toMajorNumber', () => {
  it('formats exact decimal text', () => {
    expect(fromMinor(12345, 'INR')).toBe('123.45');
    expect(fromMinor(5, 'INR')).toBe('0.05');
    expect(fromMinor(0, 'INR')).toBe('0.00');
    expect(fromMinor(-5, 'INR')).toBe('-0.05');
    expect(fromMinor(-12345, 'INR')).toBe('-123.45');
    expect(fromMinor(1235, 'JPY')).toBe('1235');
    expect(fromMinor(0, 'JPY')).toBe('0');
  });

  it('round-trips with toMinor', () => {
    for (const minor of [0, 1, 99, 100, 12345, 9007199254740991, -1, -250]) {
      expect(toMinor(fromMinor(minor, 'INR'), 'INR')).toBe(minor);
    }
    expect(toMinor(fromMinor(1235, 'JPY'), 'JPY')).toBe(1235);
  });

  it('produces the legacy major-unit number', () => {
    expect(toMajorNumber(12345, 'INR')).toBe(123.45);
    expect(toMajorNumber(-5, 'INR')).toBe(-0.05);
    expect(toMajorNumber(1235, 'JPY')).toBe(1235);
  });

  it('rejects non-integers', () => {
    expect(() => fromMinor(1.5, 'INR')).toThrow(RangeError);
    expect(() => fromMinor(NaN, 'INR')).toThrow(RangeError);
  });
});

describe('sumMinor', () => {
  it('adds exactly', () => {
    expect(sumMinor([])).toBe(0);
    expect(sumMinor([10, 20, 30])).toBe(60);
    expect(sumMinor([100, -30])).toBe(70);
  });

  it('throws on a non-integer or an overflowing sum', () => {
    expect(() => sumMinor([1, 1.5])).toThrow(RangeError);
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError);
  });
});

describe('allocateMinor and splitEqually', () => {
  it('splits a total into thirds that sum exactly', () => {
    expect(splitEqually(100, 3)).toEqual([34, 33, 33]);
    expect(splitEqually(1, 3)).toEqual([1, 0, 0]);
    expect(splitEqually(0, 3)).toEqual([0, 0, 0]);
    expect(splitEqually(100, 1)).toEqual([100]);
  });

  it('splits by weights', () => {
    expect(allocateMinor(100, [50, 30, 20])).toEqual([50, 30, 20]);
    expect(allocateMinor(1000, [33.33, 33.33, 33.34])).toEqual([333, 333, 334]);
    expect(allocateMinor(100, [1, 0, 1])).toEqual([50, 0, 50]);
    expect(allocateMinor(101, [1, 0, 1])).toEqual([51, 0, 50]);
  });

  it('splits negative totals by magnitude', () => {
    expect(splitEqually(-100, 3)).toEqual([-34, -33, -33]);
  });

  it('never loses or creates a minor unit', () => {
    const weightSets = [
      [1, 1, 1],
      [1, 2, 3],
      [33.33, 33.33, 33.34],
      [10, 20, 30, 40],
      [0.5, 99.5],
      [1, 1, 1, 1, 1, 1, 1],
    ];
    for (const weights of weightSets) {
      for (let total = -300; total <= 500; total += 1) {
        const parts = allocateMinor(total, weights);
        expect(parts).toHaveLength(weights.length);
        expect(sumMinor(parts)).toBe(total);
        for (const part of parts) {
          expect(Number.isInteger(part)).toBe(true);
        }
      }
    }
  });

  it('rejects bad input', () => {
    expect(() => allocateMinor(100, [])).toThrow(RangeError);
    expect(() => allocateMinor(100, [0, 0])).toThrow(RangeError);
    expect(() => allocateMinor(100, [1, -1])).toThrow(RangeError);
    expect(() => allocateMinor(100, [1, NaN])).toThrow(RangeError);
    expect(() => allocateMinor(1.5, [1])).toThrow(RangeError);
    expect(() => splitEqually(100, 0)).toThrow(RangeError);
    expect(() => splitEqually(100, 2.5)).toThrow(RangeError);
  });
});
