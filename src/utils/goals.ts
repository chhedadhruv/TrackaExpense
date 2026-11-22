import type {SavingsGoal} from '../types';
import {tryToMinor} from './money';

/**
 * Savings goals live in two places while the app moves from the embedded array
 * `users/{uid}.savingsGoals` to one document per goal, `users/{uid}/goals/{goalId}`. The app writes
 * both in one transaction (`src/services/GoalsService.ts`); old installed apps only write the
 * array, and a server trigger mirrors that into the documents (`functions/src/goals.ts`, whose
 * `goalDocFields` this file matches field for field, so a document written here is already what the
 * trigger would write and costs it nothing).
 */

/** The legacy fields copied from a goal to its document; same list as the server. */
const GOAL_FIELDS = [
  'name',
  'description',
  'category',
  'targetDate',
  'reminderEnabled',
  'reminderFrequency',
  'current',
  'target',
  'monthly',
  'createdAt',
  'updatedAt',
] as const;

const MINOR_FIELDS: Array<[keyof SavingsGoal, string]> = [
  ['current', 'currentMinor'],
  ['target', 'targetMinor'],
  ['monthly', 'monthlyMinor'],
];

export const DEFAULT_GOAL_CURRENCY = 'INR';

/** A three-letter currency code in upper case, else the app default (what the server does). */
export const goalCurrency = (value: unknown): string =>
  typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim())
    ? value.trim().toUpperCase()
    : DEFAULT_GOAL_CURRENCY;

/** The goal document for a goal: its legacy fields, `currency` and the exact minor amounts. */
export const goalDocFields = (
  goal: SavingsGoal,
  currency: string,
): Record<string, unknown> => {
  const source = goal as unknown as Record<string, unknown>;
  const fields: Record<string, unknown> = {};
  for (const name of GOAL_FIELDS) {
    // Firestore rejects undefined, so a missing field is simply not written.
    if (source[name] !== undefined) {
      fields[name] = source[name];
    }
  }
  fields.currency = currency;
  for (const [from, to] of MINOR_FIELDS) {
    const value = source[from];
    if (typeof value === 'number' || typeof value === 'string') {
      const minor = tryToMinor(value, currency);
      if (minor !== null) {
        fields[to] = minor;
      }
    }
  }
  return fields;
};

interface HasMillis {
  toMillis?: () => number;
}

const millisOf = (value: unknown): number | null => {
  const fn = (value as HasMillis | null | undefined)?.toMillis;
  return typeof fn === 'function'
    ? (value as {toMillis: () => number}).toMillis()
    : null;
};

const sameValue = (a: unknown, b: unknown): boolean => {
  const ma = millisOf(a);
  const mb = millisOf(b);
  if (ma !== null || mb !== null) {
    return ma === mb;
  }
  return a === b || (a == null && b == null);
};

/** True when two goals agree on every field that is copied to the goal document. */
export const goalsEqual = (a: SavingsGoal, b: SavingsGoal): boolean => {
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  return GOAL_FIELDS.every(name => sameValue(x[name], y[name]));
};

export interface RebasedGoals {
  /** The array to store: the server's current goals with this edit applied. */
  goals: SavingsGoal[];
  /** Goals whose document must be written. */
  upserts: SavingsGoal[];
  /** Ids whose document must be removed. */
  deletes: string[];
}

/**
 * Applies the edit that took the goals on screen from `previous` to `next` onto `fresh`, the array
 * as the server holds it right now. Only goals that differ between `previous` and `next` are
 * touched, so a goal another device changed in the meantime is not overwritten by this screen's
 * older copy of it. Order is kept; a new goal goes to the end.
 */
export const rebaseGoals = (
  fresh: readonly SavingsGoal[],
  previous: readonly SavingsGoal[],
  next: readonly SavingsGoal[],
): RebasedGoals => {
  const before = new Map(previous.map(g => [g.id, g]));
  const after = new Set(next.map(g => g.id));
  const upserts = next.filter(g => {
    const old = before.get(g.id);
    return old === undefined || !goalsEqual(old, g);
  });
  const deletes = previous.filter(g => !after.has(g.id)).map(g => g.id);
  const goals = fresh.filter(g => !deletes.includes(g.id));
  for (const goal of upserts) {
    const index = goals.findIndex(g => g.id === goal.id);
    if (index >= 0) {
      goals[index] = goal;
    } else {
      goals.push(goal);
    }
  }
  return {goals, upserts, deletes};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads a goal document; null when it has no usable name. The id is the document id. */
export const goalFromDoc = (id: string, data: unknown): SavingsGoal | null => {
  if (!isRecord(data) || typeof data.name !== 'string') {
    return null;
  }
  const num = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return {
    id,
    name: data.name,
    description: typeof data.description === 'string' ? data.description : '',
    current: num(data.current),
    target: num(data.target),
    monthly: num(data.monthly),
    category: typeof data.category === 'string' ? data.category : 'other',
    targetDate: typeof data.targetDate === 'string' ? data.targetDate : '',
    reminderEnabled: data.reminderEnabled === true,
    reminderFrequency:
      typeof data.reminderFrequency === 'string'
        ? data.reminderFrequency
        : null,
    createdAt: data.createdAt as SavingsGoal['createdAt'],
    updatedAt: data.updatedAt as SavingsGoal['updatedAt'],
  };
};

/** Oldest first, like the array (a new goal is appended); ties by id so the order is stable. */
export const sortGoals = (goals: readonly SavingsGoal[]): SavingsGoal[] =>
  [...goals].sort(
    (a, b) =>
      (millisOf(a.createdAt) ?? 0) - (millisOf(b.createdAt) ?? 0) ||
      a.id.localeCompare(b.id),
  );

/**
 * The goals to show: the goal documents when they are exactly the goals of the array, else the
 * array. The array is what every installed app can read and write, so it is the record to trust
 * whenever the two disagree: a profile whose documents have not all been created yet (before the
 * backfill, or after only one goal was edited), a goal an old app added or removed that the server
 * has not mirrored yet, or a stale leftover document. Showing the documents in those cases would
 * hide goals, or bring back one that was deleted.
 */
export const chooseGoals = (
  documents: readonly SavingsGoal[] | undefined,
  array: readonly SavingsGoal[],
): readonly SavingsGoal[] => {
  if (documents === undefined || documents.length === 0) {
    return array;
  }
  const ids = new Set(documents.map(g => g.id));
  const sameGoals =
    ids.size === documents.length &&
    array.length === documents.length &&
    array.every(g => ids.has(g.id));
  return sameGoals ? documents : array;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days it took to reach the target, when this deposit is the one that completed the goal; null
 * when the goal was already complete, or is still short of its target. Used for analytics only.
 * A goal without a creation time (very old data) reports 0 days.
 */
export const daysToCompleteGoal = (
  before: Pick<SavingsGoal, 'current' | 'target' | 'createdAt'>,
  newCurrent: number,
  nowMs: number,
): number | null => {
  if (before.current >= before.target || newCurrent < before.target) {
    return null;
  }
  const startedMs = before.createdAt?.toMillis?.();
  if (typeof startedMs !== 'number') {
    return 0;
  }
  return Math.max(0, Math.round((nowMs - startedMs) / DAY_MS));
};
