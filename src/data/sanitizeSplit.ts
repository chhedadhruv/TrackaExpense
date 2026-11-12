/**
 * Old versions of the app saved a full copy of each member's profile inside the split documents
 * (in `paidBy` and in every `splitUsers` entry): phone, push token, balance, savings goals. The
 * screens read only a few fields of a person, so the cached copy keeps only those. This keeps
 * other people's phone numbers and push tokens out of the data saved on this phone, and out of
 * memory. The documents on the server are not touched.
 *
 * Read by the screens (checked with a search of the code):
 * - paidBy: email, name, userId
 * - splitUsers entries: email, name, userId, percentage
 */

const PERSON_FIELDS = ['email', 'name', 'userId', 'percentage'] as const;

const pickPerson = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of PERSON_FIELDS) {
    if (field in source) {
      out[field] = source[field];
    }
  }
  return out;
};

/** A copy of a split document in which each person keeps only the fields the screens read. */
export const sanitizeSplit = <T extends Record<string, unknown>>(
  split: T,
): T => {
  const out: Record<string, unknown> = {...split};
  if ('paidBy' in split) {
    out.paidBy = pickPerson(split.paidBy);
  }
  if ('splitUsers' in split) {
    const users = split.splitUsers;
    out.splitUsers = Array.isArray(users) ? users.map(pickPerson) : users;
  }
  return out as T;
};

/**
 * The same reduction for a split history entry: the person in `paidBy` and in `settlement.from`
 * and `settlement.to` (the history screen reads only email, name and user id of them). The
 * `changes` list is already plain text summaries.
 */
export const sanitizeHistoryEntry = <T extends Record<string, unknown>>(
  entry: T,
): T => {
  const out: Record<string, unknown> = {...entry};
  if ('paidBy' in entry) {
    out.paidBy = pickPerson(entry.paidBy);
  }
  const settlement = entry.settlement;
  if (
    typeof settlement === 'object' &&
    settlement !== null &&
    !Array.isArray(settlement)
  ) {
    const s = settlement as Record<string, unknown>;
    const next: Record<string, unknown> = {...s};
    if ('from' in s) {
      next.from = pickPerson(s.from);
    }
    if ('to' in s) {
      next.to = pickPerson(s.to);
    }
    out.settlement = next;
  }
  return out as T;
};
