/**
 * Turns Expo Router segments into a stable screen name for analytics, for example
 * ['(app)', '(split)', 'group', '[id]'] becomes 'split/group/[id]'.
 *
 * Route groups in parentheses are dropped, except the tab folder which is kept because it says
 * which tab the screen belongs to. Dynamic segments stay as their '[id]' placeholder, so a
 * group id, transaction id or invite code never reaches analytics. Returns null when there is
 * nothing to report yet.
 */
export const screenNameFromSegments = (
  segments: readonly string[],
): string | null => {
  const parts = segments
    .filter(part => part !== '(app)' && part !== '(auth)')
    .map(part =>
      part.startsWith('(') && part.endsWith(')') ? part.slice(1, -1) : part,
    )
    .filter(part => part.length > 0);
  if (parts.length === 0) {
    return null;
  }
  return parts.join('/');
};
