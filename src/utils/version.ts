/**
 * Compares two dotted version strings such as "1.3.5". Missing parts count as 0 and any
 * non-numeric suffix on a part (for example "5-beta") is ignored.
 * Returns a negative number when a < b, 0 when equal, and a positive number when a > b.
 */
export const compareVersions = (a: string, b: string): number => {
  const parse = (value: string): number[] =>
    value
      .trim()
      .split('.')
      .map(part => {
        const n = parseInt(part, 10);
        return Number.isNaN(n) ? 0 : n;
      });
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

/** True when `current` is older than `minimum`. An empty minimum never blocks. */
export const isVersionBelow = (current: string, minimum: string): boolean => {
  if (!minimum || !minimum.trim()) {
    return false;
  }
  return compareVersions(current, minimum) < 0;
};
