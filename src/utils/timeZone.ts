/**
 * The device time zone as stored on the profile (`users/{uid}.timeZone`). The scheduled jobs in
 * functions/ (weekly and monthly summaries, settle and card reminders, the evening nudge, budgets,
 * recurring rules) read it to decide what "9 AM" and "today" mean for each person; without it
 * they assume Asia/Kolkata.
 */

/** True for a zone name the runtime knows (an IANA name such as "Asia/Kolkata" or "UTC"). */
export const isValidTimeZone = (zone: unknown): zone is string => {
  if (typeof zone !== 'string' || zone.trim() === '') {
    return false;
  }
  try {
    // An unknown zone makes the constructor throw; asking for the resolved name uses the result.
    return (
      new Intl.DateTimeFormat('en-US', {timeZone: zone}).resolvedOptions()
        .timeZone !== ''
    );
  } catch {
    return false;
  }
};

/**
 * The device's zone, or null when it cannot be read. Unlike `deviceTimeZone` in budgets.ts there is
 * no fallback: storing a guessed zone would label the person with the wrong one.
 */
export const readDeviceTimeZone = (): string | null => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : null;
  } catch {
    return null;
  }
};

/**
 * What to write, or null when nothing needs writing: the device zone when it is valid and differs
 * from the one saved on the profile.
 */
export const timeZoneToSave = (
  deviceZone: string | null | undefined,
  savedZone: unknown,
): string | null => {
  if (!isValidTimeZone(deviceZone)) {
    return null;
  }
  return deviceZone === savedZone ? null : deviceZone;
};
