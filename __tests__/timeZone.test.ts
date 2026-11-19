import {describe, expect, it} from '@jest/globals';
import {
  isValidTimeZone,
  readDeviceTimeZone,
  timeZoneToSave,
} from '../src/utils/timeZone';

describe('isValidTimeZone', () => {
  it('accepts IANA names', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('   ')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(5)).toBe(false);
  });
});

describe('timeZoneToSave', () => {
  it('writes the device zone when nothing is saved', () => {
    expect(timeZoneToSave('Asia/Kolkata', undefined)).toBe('Asia/Kolkata');
    expect(timeZoneToSave('Asia/Kolkata', null)).toBe('Asia/Kolkata');
  });

  it('writes again when the person moved to another zone', () => {
    expect(timeZoneToSave('Europe/London', 'Asia/Kolkata')).toBe(
      'Europe/London',
    );
  });

  it('writes nothing when the saved zone already matches', () => {
    expect(timeZoneToSave('Asia/Kolkata', 'Asia/Kolkata')).toBeNull();
  });

  it('replaces a saved value that is not a text', () => {
    expect(timeZoneToSave('Asia/Kolkata', 5)).toBe('Asia/Kolkata');
  });

  it('never writes an unreadable or invalid device zone', () => {
    expect(timeZoneToSave(null, 'Asia/Kolkata')).toBeNull();
    expect(timeZoneToSave(undefined, undefined)).toBeNull();
    expect(timeZoneToSave('Not/AZone', undefined)).toBeNull();
    expect(timeZoneToSave('', undefined)).toBeNull();
  });
});

describe('readDeviceTimeZone', () => {
  it('returns a valid zone or null, never a guess', () => {
    const zone = readDeviceTimeZone();
    expect(zone === null || isValidTimeZone(zone)).toBe(true);
  });
});
