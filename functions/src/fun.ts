import {DEFAULT_TIME_ZONE} from './budgets';
import {localMoment} from './weekly';

export type FunContext = 'evening' | 'weekend' | 'motivational' | 'funny';

export const FUN_TITLES: Readonly<Record<FunContext, string>> = {
  evening: 'Hey there!',
  weekend: 'Weekend Vibes!',
  motivational: "You're Amazing!",
  funny: 'LOL!',
};

export const FUN_MESSAGES: Readonly<Record<FunContext, readonly string[]>> = {
  evening: [
    'Evening! Time to wrap up your day with some financial tracking!',
    "Good evening! Your expenses are calling - don't keep them waiting!",
    'Evening check-in! How did your money behave today?',
    "Hey! Don't let today's expenses slip away - log them now!",
    "Good evening! Your financial diary is waiting for today's entry!",
  ],
  weekend: [
    "Weekend vibes! But your expenses don't take weekends off!",
    'Happy weekend! Time to catch up on your financial tracking!',
    'Weekend mode! Your budget still needs your attention!',
    "Hey! Weekend expenses count too - don't forget to log them!",
    'Weekend! Your financial goals are still working hard for you!',
  ],
  motivational: [
    "You're doing amazing! Every expense you track is a step towards financial freedom!",
    'Keep going! Your financial discipline is inspiring!',
    "You're on fire! Your money management skills are getting stronger!",
    "Amazing work! You're building wealth one transaction at a time!",
    "You're unstoppable! Your financial future is in great hands!",
  ],
  funny: [
    'Your expenses are like your ex - they keep coming back! Time to track them!',
    'Money talks, but yours is probably saying "Why don\'t you track me?"',
    "Your wallet is like a good friend - it's always there, but you should check on it!",
    'Expenses are like calories - they add up whether you count them or not!',
    'Your budget is like a plant - it needs regular attention to grow!',
  ],
};

/** The nudge goes out at one local hour between these two (inclusive), different per person and day. */
export const FUN_FIRST_HOUR = 18;
export const FUN_LAST_HOUR = 21;

const HASH_MODULUS = 4_294_967_291;

/** Small stable hash so the "random" hour and message are repeatable and testable. */
export const hashText = (text: string): number => {
  let h = 7;
  for (let i = 0; i < text.length; i += 1) {
    // h stays below 2^32, so h * 131 is far inside the safe integer range.
    h = (h * 131 + text.charCodeAt(i)) % HASH_MODULUS;
  }
  return h;
};

/**
 * The person's own switch, `users/{uid}.funNudgeEnabled` (written by the app, Profile > Notifications).
 * Only an explicit false opts out: a missing field (everyone before the switch existed) or any other
 * value keeps the nudge on, so nobody is silently dropped by a bad write.
 */
export const funNudgeAllowed = (value: unknown): boolean => value !== false;

/** The local hour (18 to 21) at which this person's nudge goes out on this local date. */
export const funHourFor = (uid: string, date: string): number =>
  FUN_FIRST_HOUR +
  (hashText(`${uid}|${date}`) % (FUN_LAST_HOUR - FUN_FIRST_HOUR + 1));

/**
 * Whether the nudge is due now: the person's local hour is their chosen hour for today. Returns
 * the local date to key the marker with, or null.
 */
export const funDueDate = (
  nowMs: number,
  uid: string,
  timeZone: string,
): {date: string; weekday: number} | null => {
  const local = localMoment(nowMs, timeZone || DEFAULT_TIME_ZONE);
  return local.hour === funHourFor(uid, local.date)
    ? {date: local.date, weekday: local.weekday}
    : null;
};

/**
 * The tone, from the old server's rules: active today gets praise; nothing for two days gets
 * the funny line at a weekend and praise on a weekday; otherwise weekend or evening.
 */
export const funContext = (
  activeToday: boolean,
  activeRecently: boolean,
  weekday: number,
): FunContext => {
  const weekend = weekday === 0 || weekday === 6;
  if (activeToday) {
    return 'motivational';
  }
  if (!activeRecently) {
    return weekend ? 'funny' : 'motivational';
  }
  return weekend ? 'weekend' : 'evening';
};

export const funMessage = (
  context: FunContext,
  uid: string,
  date: string,
): {title: string; body: string} => {
  const lines = FUN_MESSAGES[context];
  return {
    title: FUN_TITLES[context],
    body: lines[hashText(`${uid}|${date}|msg`) % lines.length],
  };
};
