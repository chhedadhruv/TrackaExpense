/**
 * The evening reminder switch, `users/{uid}.funNudgeEnabled`. Only an explicit false is off, so a
 * profile that has never had the field (everyone before the switch existed) stays on. The server
 * applies the same rule in functions/src/fun.ts (`funNudgeAllowed`): change both together.
 */
export const isFunNudgeOn = (value: boolean | null | undefined): boolean =>
  value !== false;
