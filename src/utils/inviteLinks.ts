/**
 * Group invite links. A member shares `https://trackaexpense.dhruvchheda.com/join#g=<group>&t=<token>`;
 * that page (a static page on the project website) opens the app with
 * `trackaexpense://split/join/<group>/<token>`, which is the route `/split/join/[groupId]/[token]`.
 * The link carries the secret in the URL fragment, which browsers never send to a server, so the
 * token stays out of web server logs and analytics. The server keeps only a hash of the token
 * (functions/src/inviteLinks.ts).
 */

export const INVITE_LINK_BASE = 'https://trackaexpense.dhruvchheda.com/join';

const GROUP_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TOKEN = /^[A-Za-z0-9_-]{22}$/;

export interface InviteTarget {
  groupId: string;
  token: string;
}

const valid = (groupId: string, token: string): InviteTarget | null =>
  GROUP_ID.test(groupId) && TOKEN.test(token) ? {groupId, token} : null;

/** The link a member shares. */
export const buildInviteUrl = (groupId: string, token: string): string =>
  `${INVITE_LINK_BASE}#g=${encodeURIComponent(groupId)}&t=${encodeURIComponent(
    token,
  )}`;

/** The app route for an invite. */
export const joinPath = (groupId: string, token: string): string =>
  `/split/join/${groupId}/${token}`;

/**
 * Reads an invite out of a shared link or an app path: the web link with its fragment, the app's
 * own `trackaexpense://split/join/<group>/<token>` link, or the bare path. Null for anything else.
 */
export const parseInviteInput = (input: string): InviteTarget | null => {
  const text = input.trim();
  const hash = text.indexOf('#');
  if (hash >= 0) {
    const params = new URLSearchParams(text.slice(hash + 1));
    const g = params.get('g');
    const t = params.get('t');
    return g && t ? valid(g, t) : null;
  }
  const match =
    /(?:^|[/:])split\/join\/([^/?#]+)\/([^/?#]+)\/?(?:[?#].*)?$/.exec(text);
  return match ? valid(match[1], match[2]) : null;
};

// Our own invite page: https, our host, the /join path (a trailing slash or query is allowed).
const INVITE_PAGE =
  /^https:\/\/trackaexpense\.dhruvchheda\.com\/join\/?(?:[?#]|$)/i;

/**
 * Rewrites an incoming system URL for Expo Router (`app/+native-intent.ts` calls this for every
 * link that opens the app). A verified Android App Link to our invite page carries the invite in
 * its fragment and would otherwise reach the router as an unknown `https` path: it becomes the
 * app route for the invite. A `/join` link whose fragment is missing or malformed goes to the
 * Split tab instead of an "unmatched route" screen. Every other URL, including the app's own
 * `trackaexpense://` links, is returned unchanged.
 */
export const systemPathFor = (url: string): string => {
  if (!INVITE_PAGE.test(url.trim())) {
    return url;
  }
  const target = parseInviteInput(url);
  return target ? joinPath(target.groupId, target.token) : '/split';
};

const GENERIC_ERROR =
  'Could not use this invite link. Check your connection and try again.';

/**
 * The server's own wording for a refused link ("This invite link has expired."), else a generic
 * line. A bare code such as NOT_FOUND or UNAVAILABLE (the function missing, or no connection) is
 * not worded for people, so it gets the generic line too.
 */
export const inviteLinkErrorMessage = (error: unknown): string => {
  const message = (error as {message?: unknown} | null)?.message;
  if (typeof message === 'string') {
    // The callable error text is "[functions/<code>] message"; keep only the message.
    const cleaned = message.replace(/^\[[^\]]*\]\s*/, '').trim();
    if (cleaned !== '' && !/^[A-Z_]+$/.test(cleaned)) {
      return cleaned;
    }
  }
  return GENERIC_ERROR;
};

/** The text of the share sheet. */
export const inviteMessage = (groupName: string, url: string): string =>
  `Join "${groupName}" on TrackaExpense: ${url}\nThe link works for 7 days.`;
