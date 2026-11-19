/**
 * The evening reminder switch, `users/{uid}.funNudgeEnabled`. Only an explicit false is off, so a
 * profile that has never had the field (everyone before the switch existed) stays on. The server
 * applies the same rule in functions/src/fun.ts (`funNudgeAllowed`): change both together.
 */
export const isFunNudgeOn = (value: boolean | null | undefined): boolean =>
  value !== false;

/**
 * The card bill reminder switch, `users/{uid}.cardRemindersEnabled`, with the same rule: only an
 * explicit false is off. The server applies it in functions/src/cardDue.ts
 * (`cardRemindersAllowed`): change both together.
 */
export const isCardRemindersOn = (value: boolean | null | undefined): boolean =>
  value !== false;
