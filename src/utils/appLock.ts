/**
 * The decision part of the app lock, kept free of native imports so it can be tested.
 *
 * The lock is optional and per device. When it is on, the app asks for a fingerprint, Face ID or
 * the device passcode on a cold start, and when it comes back from the background after
 * LOCK_GRACE_MS (see src/lock/AppLockProvider.tsx).
 */

export const LOCK_STORAGE_KEY = 'appLock.enabled';

/** How long the app may stay in the background before it asks again. */
export const LOCK_GRACE_MS = 30_000;

/** Reads the saved setting. Anything other than the exact text "true" is off. */
export const parseLockSetting = (raw: string | null | undefined): boolean =>
  raw === 'true';

export interface ForegroundLockInput {
  enabled: boolean;
  /** When the app left the foreground (ms), or null if it did not. */
  backgroundedAt: number | null;
  now: number;
  graceMs?: number;
  /** True when this trip was started by the app itself (camera, share sheet, permission prompt). */
  suppressed?: boolean;
}

/** Whether coming back to the foreground should lock the app. */
export const shouldLockOnForeground = ({
  enabled,
  backgroundedAt,
  now,
  graceMs = LOCK_GRACE_MS,
  suppressed = false,
}: ForegroundLockInput): boolean => {
  if (!enabled || suppressed || backgroundedAt === null) {
    return false;
  }
  const away = now - backgroundedAt;
  // A clock that moved backwards is treated as away for too long: lock rather than stay open.
  if (away < 0) {
    return true;
  }
  return away >= graceMs;
};

/**
 * A trip the app starts itself (camera, gallery, share sheet, permission prompt) must not lock it
 * on the way back. The flag expires, so a picker that never leaves the app (the iOS photo picker
 * runs inside it) cannot leave the lock switched off for a later, real trip to the background.
 */
export const SUPPRESS_WINDOW_MS = 120_000;

export const suppressedUntil = (now: number): number =>
  now + SUPPRESS_WINDOW_MS;

export const isSuppressed = (until: number, now: number): boolean =>
  now <= until;
