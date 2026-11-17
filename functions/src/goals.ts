import {changedFields, resolveCurrency, type Fields} from './derive';
import {tryToMinor} from './money';

/**
 * Savings goals live in two places while the app moves from the embedded array
 * `users/{uid}.savingsGoals` to one document per goal, `users/{uid}/goals/{goalId}`. Old installed
 * apps only write the array, so the array stays the record they see; the goal documents are what
 * the new app reads. These pure functions decide what the goal documents must look like for a given
 * array, and are shared by the trigger (old-app writes) and the backfill (goals that exist now).
 */

/** The legacy fields copied from an array entry to the goal document. */
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

const MINOR_FIELDS: Array<[string, string]> = [
  ['current', 'currentMinor'],
  ['target', 'targetMinor'],
  ['monthly', 'monthlyMinor'],
];

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isGoalId = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !value.includes('/');

/**
 * The goal document for one array entry: the legacy fields as they are, plus `currency` and the
 * exact integer minor amounts. A value that cannot be converted leaves its minor field out (it is
 * reported by the user trigger's own derivation, and never stops the goal being copied).
 */
export const goalDocFields = (entry: Fields, currency: string): Fields => {
  const fields: Fields = {};
  for (const name of GOAL_FIELDS) {
    if (entry[name] !== undefined) {
      fields[name] = entry[name];
    }
  }
  fields.currency = currency;
  for (const [from, to] of MINOR_FIELDS) {
    const value = entry[from];
    if (typeof value === 'number' || typeof value === 'string') {
      const minor = tryToMinor(value, currency);
      if (minor !== null) {
        fields[to] = minor;
      }
    }
  }
  return fields;
};

/** Usable entries of the array by id; an entry without a usable id is ignored, a repeated id keeps the last. */
const entriesById = (array: unknown): Map<string, Fields> => {
  const byId = new Map<string, Fields>();
  if (Array.isArray(array)) {
    for (const entry of array) {
      if (isRecord(entry) && isGoalId(entry.id)) {
        byId.set(entry.id, entry);
      }
    }
  }
  return byId;
};

export interface GoalSyncPlan {
  /** Goal documents to write (the whole document), by goal id. */
  upserts: Array<{id: string; fields: Fields}>;
  /** Goal ids whose document must be removed. */
  deletes: string[];
}

/**
 * What the goal documents need after the array changed from `before` to `after`.
 *
 * - A goal that is new or whose entry changed is written.
 * - A goal that was in `before` and is gone from `after` is deleted. Only those ids are deleted, so
 *   a goal document the new app has just created (and not yet mirrored into the array) is never
 *   removed by an old app's write that simply does not know about it.
 * - Pass `before` undefined to treat every goal in `after` as new (the backfill).
 */
export const planGoalSync = (
  before: unknown,
  after: unknown,
  currency: unknown,
): GoalSyncPlan => {
  const code = resolveCurrency(currency);
  const previous = entriesById(before);
  const next = entriesById(after);
  const plan: GoalSyncPlan = {upserts: [], deletes: []};
  for (const [id, entry] of next) {
    const fields = goalDocFields(entry, code);
    const old = previous.get(id);
    if (old && changedFields(goalDocFields(old, code), fields) === null) {
      continue;
    }
    plan.upserts.push({id, fields});
  }
  for (const id of previous.keys()) {
    if (!next.has(id)) {
      plan.deletes.push(id);
    }
  }
  return plan;
};

/** True when the stored goal document already equals what the array says. */
export const goalDocUpToDate = (existing: Fields, fields: Fields): boolean =>
  changedFields(existing, fields) === null &&
  // `changedFields` ignores fields only the document has; a field the array no longer has must go.
  Object.keys(existing).every(key => key in fields);
