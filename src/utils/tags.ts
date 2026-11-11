/**
 * Transaction tags: free text, at most MAX_TAGS_PER_TRANSACTION per transaction and MAX_TAG_LENGTH
 * characters each. Tags are stored as typed but compared ignoring case, so "Trip" and "trip" are
 * the same tag.
 */

export const MAX_TAGS_PER_TRANSACTION = 5;
export const MAX_TAG_LENGTH = 24;

export type TagError = 'empty' | 'too_long' | 'limit' | 'duplicate';

/** Trims, drops a leading "#" (people type it out of habit) and collapses inner whitespace. */
export const cleanTag = (raw: string): string =>
  raw.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ');

/** The case-insensitive identity of a tag. */
export const tagKey = (tag: string): string => cleanTag(tag).toLowerCase();

/**
 * Document id of a tag in `users/{uid}/tags`. Prefixed because "." and ".." are not valid ids, and
 * encoded because a tag may contain "/".
 */
export const tagDocId = (tag: string): string =>
  `t_${encodeURIComponent(tagKey(tag))}`;

export const tagErrorMessage = (error: TagError): string => {
  switch (error) {
    case 'empty':
      return 'Type a tag first';
    case 'too_long':
      return `A tag can be at most ${MAX_TAG_LENGTH} characters`;
    case 'limit':
      return `You can add up to ${MAX_TAGS_PER_TRANSACTION} tags`;
    case 'duplicate':
      return 'That tag is already added';
  }
};

/** Adds a tag to a list, or says why it cannot be added (the list is then unchanged). */
export const addTag = (
  tags: readonly string[],
  raw: string,
): {tags: string[]; error?: TagError} => {
  const cleaned = cleanTag(raw);
  if (!cleaned) {
    return {tags: [...tags], error: 'empty'};
  }
  if (cleaned.length > MAX_TAG_LENGTH) {
    return {tags: [...tags], error: 'too_long'};
  }
  const key = cleaned.toLowerCase();
  if (tags.some(t => tagKey(t) === key)) {
    return {tags: [...tags], error: 'duplicate'};
  }
  if (tags.length >= MAX_TAGS_PER_TRANSACTION) {
    return {tags: [...tags], error: 'limit'};
  }
  return {tags: [...tags, cleaned]};
};

export const removeTag = (tags: readonly string[], tag: string): string[] => {
  const key = tagKey(tag);
  return tags.filter(t => tagKey(t) !== key);
};

/**
 * Tags read from Firestore. Documents written before tags existed have none, and an old or odd
 * write could hold anything, so keep only clean, distinct strings within the limits.
 */
export const sanitizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  let result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const next = addTag(result, item);
    if (!next.error) {
      result = next.tags;
    }
  }
  return result;
};

/**
 * Known tags to offer while typing: not already selected, and (when something is typed) containing
 * the text, those starting with it first. `known` is expected most recently used first.
 */
export const suggestTags = (
  known: readonly string[],
  input: string,
  selected: readonly string[],
  limit = 8,
): string[] => {
  const taken = new Set(selected.map(tagKey));
  const query = tagKey(input);
  const available = known.filter(t => !taken.has(tagKey(t)));
  if (!query) {
    return available.slice(0, limit);
  }
  const startsWith = available.filter(t => tagKey(t).startsWith(query));
  const contains = available.filter(
    t => !tagKey(t).startsWith(query) && tagKey(t).includes(query),
  );
  return [...startsWith, ...contains].slice(0, limit);
};

/** The selected tags that are not in the user's tag list yet, so only those need saving. */
export const unknownTags = (
  selected: readonly string[],
  known: readonly string[],
): string[] => {
  const knownKeys = new Set(known.map(tagKey));
  return selected.filter(t => !knownKeys.has(tagKey(t)));
};

/**
 * The distinct tags on a set of transactions with how many transactions carry each, most used
 * first (ties alphabetical). The first spelling met is the one shown. Used to offer only tags that
 * would actually return rows.
 */
export const collectTags = (
  transactions: readonly {tags?: unknown}[],
): {tag: string; count: number}[] => {
  const byKey = new Map<string, {tag: string; count: number}>();
  transactions.forEach(transaction => {
    sanitizeTags(transaction.tags).forEach(tag => {
      const key = tagKey(tag);
      const entry = byKey.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        byKey.set(key, {tag, count: 1});
      }
    });
  });
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  );
};

/** Whether a transaction carries a tag (ignoring case); used by the list filter. */
export const hasTag = (transaction: {tags?: unknown}, tag: string): boolean => {
  const key = tagKey(tag);
  return sanitizeTags(transaction.tags).some(t => tagKey(t) === key);
};
