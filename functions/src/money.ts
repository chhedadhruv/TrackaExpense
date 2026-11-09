/**
 * Money helpers based on integer minor units (paise for INR, cents for USD).
 *
 * Why: amounts used to be JS floats in major units, often stored as strings with up to 4
 * decimals. Floats cannot add or split money exactly (0.1 + 0.2 !== 0.3), so new code stores and
 * calculates in integer minor units and only formats for display.
 *
 * Rules:
 * - Conversion to minor units rounds half away from zero at the currency's minor unit.
 * - Parsing works on the decimal text of the value, never on float arithmetic, so what the user
 *   typed (for example 1.005) is what gets rounded (to 1.01).
 * - Every function returns a safe integer or throws; there is no silent NaN.
 */

/**
 * Number of decimal places in the minor unit. Every currency the app supports uses 2, except
 * the two listed here. Unknown currency codes default to 2.
 */
export const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  JPY: 0,
  KRW: 0,
};

const DEFAULT_EXPONENT = 2;

/** Scale used for allocation weights (4 decimals, enough for percentages like 33.3333). */
const WEIGHT_SCALE = 10000;

export const getCurrencyExponent = (currency: string): number =>
  CURRENCY_EXPONENTS[currency.toUpperCase()] ?? DEFAULT_EXPONENT;

const assertSafeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer, got ${value}`);
  }
};

/** Returns the plain decimal text of a value ("-12.5"), or null if it is not a plain number. */
const toDecimalText = (value: string | number): string | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    const text = value.toString();
    if (!text.includes('e')) {
      return text;
    }
    // Exponent notation: tiny numbers round to zero anyway, huge ones are out of range.
    return Math.abs(value) < 1 ? value.toFixed(20) : null;
  }
  const trimmed = value.trim();
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(trimmed)) {
    return trimmed.replace(/,/g, '');
  }
  return trimmed;
};

const DECIMAL_PATTERN = /^([+-])?(\d*)(?:\.(\d*))?$/;

/**
 * Converts an amount in major units (a number or a numeric string) to integer minor units,
 * or returns null when the value is empty, not a number, or out of the safe integer range.
 */
export const tryToMinor = (
  value: string | number,
  currency: string,
): number | null => {
  const text = toDecimalText(value);
  if (text === null) {
    return null;
  }
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const [, sign, integerPart = '', fractionPart = ''] = match;
  if (integerPart === '' && fractionPart === '') {
    return null;
  }
  const exponent = getCurrencyExponent(currency);
  // Pad so that there is always a first dropped digit to look at.
  const fraction = fractionPart.padEnd(exponent + 1, '0');
  const kept = fraction.slice(0, exponent);
  const firstDropped = fraction.charAt(exponent);

  let magnitude = BigInt(`${integerPart || '0'}${kept}`);
  if (firstDropped >= '5') {
    magnitude += 1n;
  }
  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  const result = Number(magnitude);
  return sign === '-' && result !== 0 ? -result : result;
};

/** Like tryToMinor but throws a RangeError for a value that cannot be converted. */
export const toMinor = (value: string | number, currency: string): number => {
  const minor = tryToMinor(value, currency);
  if (minor === null) {
    throw new RangeError(`Invalid amount: ${String(value)}`);
  }
  return minor;
};

/** Exact decimal text for a minor-unit amount: 12345 -> "123.45" (INR), 1235 -> "1235" (JPY). */
export const fromMinor = (minor: number, currency: string): string => {
  assertSafeInteger(minor, 'minor');
  const exponent = getCurrencyExponent(currency);
  const digits = Math.abs(minor)
    .toString()
    .padStart(exponent + 1, '0');
  const integerPart = digits.slice(0, digits.length - exponent);
  const fractionPart = digits.slice(digits.length - exponent);
  const body = exponent > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  return minor < 0 ? `-${body}` : body;
};

/** Minor units as a number in major units, for the legacy `amount` field (12345 -> 123.45). */
export const toMajorNumber = (minor: number, currency: string): number =>
  Number(fromMinor(minor, currency));

/** Sum of minor-unit amounts, checked to stay a safe integer. */
export const sumMinor = (values: readonly number[]): number => {
  let total = 0;
  for (const value of values) {
    assertSafeInteger(value, 'amount');
    total += value;
    assertSafeInteger(total, 'sum');
  }
  return total;
};

/**
 * Splits a total (minor units) in proportion to the weights, so that the parts add up to the
 * total exactly. Uses the largest remainder method; ties go to the earlier part. Weights are
 * non-negative numbers (for example percentages, accurate to 4 decimals). A negative total
 * is split by its magnitude and the sign is applied to every part.
 */
export const allocateMinor = (
  total: number,
  weights: readonly number[],
): number[] => {
  assertSafeInteger(total, 'total');
  if (weights.length === 0) {
    throw new RangeError('allocateMinor needs at least one weight');
  }
  const scaled = weights.map(weight => {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError(`Invalid weight: ${weight}`);
    }
    return BigInt(Math.round(weight * WEIGHT_SCALE));
  });
  const weightSum = scaled.reduce((a, b) => a + b, 0n);
  if (weightSum === 0n) {
    throw new RangeError('Weights must not all be zero');
  }

  const magnitude = BigInt(Math.abs(total));
  const sign = total < 0 ? -1n : 1n;
  const parts = scaled.map(weight => (magnitude * weight) / weightSum);
  const remainders = scaled.map((weight, index) => ({
    index,
    remainder: (magnitude * weight) % weightSum,
  }));
  remainders.sort((a, b) => {
    if (a.remainder === b.remainder) {
      return a.index - b.index;
    }
    return a.remainder > b.remainder ? -1 : 1;
  });

  let leftover = magnitude - parts.reduce((a, b) => a + b, 0n);
  for (let k = 0; leftover > 0n; k += 1) {
    parts[remainders[k].index] += 1n;
    leftover -= 1n;
  }
  return parts.map(part => Number(sign * part));
};

/** Splits a total (minor units) equally; the first parts get the extra minor unit. */
export const splitEqually = (total: number, parts: number): number[] => {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new RangeError(`parts must be a positive integer, got ${parts}`);
  }
  return allocateMinor(total, new Array<number>(parts).fill(1));
};
