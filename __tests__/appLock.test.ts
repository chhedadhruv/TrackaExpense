import {describe, expect, it} from '@jest/globals';
import {
  isSuppressed,
  LOCK_GRACE_MS,
  parseLockSetting,
  shouldLockOnForeground,
  SUPPRESS_WINDOW_MS,
  suppressedUntil,
} from '../src/utils/appLock';

describe('parseLockSetting', () => {
  it('is on only for the exact text "true"', () => {
    expect(parseLockSetting('true')).toBe(true);
    expect(parseLockSetting('false')).toBe(false);
    expect(parseLockSetting('TRUE')).toBe(false);
    expect(parseLockSetting('1')).toBe(false);
    expect(parseLockSetting('')).toBe(false);
    expect(parseLockSetting(null)).toBe(false);
    expect(parseLockSetting(undefined)).toBe(false);
  });
});

describe('shouldLockOnForeground', () => {
  const now = 1_000_000;

  it('never locks when the lock is off', () => {
    expect(
      shouldLockOnForeground({enabled: false, backgroundedAt: 0, now}),
    ).toBe(false);
  });

  it('does not lock when the app was not in the background', () => {
    expect(
      shouldLockOnForeground({enabled: true, backgroundedAt: null, now}),
    ).toBe(false);
  });

  it('stays open inside the grace period', () => {
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: now - (LOCK_GRACE_MS - 1),
        now,
      }),
    ).toBe(false);
  });

  it('locks exactly at the grace period and after it', () => {
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: now - LOCK_GRACE_MS,
        now,
      }),
    ).toBe(true);
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: now - 10 * 60_000,
        now,
      }),
    ).toBe(true);
  });

  it('ignores a trip the app started itself, even after a long time', () => {
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: now - 10 * 60_000,
        now,
        suppressed: true,
      }),
    ).toBe(false);
  });

  it('honours a custom grace period', () => {
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: now - 5_000,
        now,
        graceMs: 5_000,
      }),
    ).toBe(true);
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: now - 4_999,
        now,
        graceMs: 5_000,
      }),
    ).toBe(false);
  });

  it('locks when the clock moved backwards', () => {
    expect(
      shouldLockOnForeground({enabled: true, backgroundedAt: now + 1_000, now}),
    ).toBe(true);
  });
});

describe('suppression window', () => {
  it('is active inside the window and over after it', () => {
    const until = suppressedUntil(1_000);
    expect(isSuppressed(until, 1_000)).toBe(true);
    expect(isSuppressed(until, 1_000 + SUPPRESS_WINDOW_MS)).toBe(true);
    expect(isSuppressed(until, 1_001 + SUPPRESS_WINDOW_MS)).toBe(false);
  });

  it('is not active when never set', () => {
    expect(isSuppressed(0, 1_000)).toBe(false);
  });
});
