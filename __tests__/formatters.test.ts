import {describe, it, expect} from '@jest/globals';
import {
  formatDisplayDate,
  formatInputAmount,
  formatTimestampDate,
  todayAsYMD,
} from '../src/utils/formatters';

describe('formatInputAmount', () => {
  it('adds thousands separators', () => {
    expect(formatInputAmount('1000')).toBe('1,000');
    expect(formatInputAmount('1234567')).toBe('1,234,567');
  });

  it('keeps the decimal part untouched', () => {
    expect(formatInputAmount('1000.50')).toBe('1,000.50');
    expect(formatInputAmount('999.')).toBe('999.');
  });

  it('accepts numbers and already formatted strings', () => {
    expect(formatInputAmount(2500)).toBe('2,500');
    expect(formatInputAmount('1,000')).toBe('1,000');
  });

  it('returns an empty string for empty input and keeps zero', () => {
    expect(formatInputAmount('')).toBe('');
    expect(formatInputAmount(0)).toBe('0');
  });
});

describe('formatDisplayDate', () => {
  it('formats a local date string', () => {
    expect(formatDisplayDate('2024-03-15T12:00:00')).toBe('March 15, 2024');
  });

  it('returns an empty string when there is no date', () => {
    expect(formatDisplayDate(undefined)).toBe('');
    expect(formatDisplayDate('')).toBe('');
  });
});

describe('todayAsYMD', () => {
  it('returns today as YYYY-MM-DD', () => {
    expect(todayAsYMD()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatTimestampDate', () => {
  const at = (iso: string) => ({toDate: () => new Date(iso)});

  it('uses the date when present', () => {
    expect(formatTimestampDate(at('2024-03-15T12:00:00'))).toBe(
      'March 15, 2024',
    );
  });

  it('falls back to createdAt for legacy split records', () => {
    expect(formatTimestampDate(undefined, at('2023-01-02T12:00:00'))).toBe(
      'January 2, 2023',
    );
    expect(formatTimestampDate(null, at('2023-01-02T12:00:00'))).toBe(
      'January 2, 2023',
    );
  });

  it('returns an empty string when neither is present', () => {
    expect(formatTimestampDate(undefined)).toBe('');
  });
});
