import {router} from 'expo-router';

/**
 * Opens an app path (for example "/split/invitations") from code that has no component, such as a
 * tapped push notification. A tap can arrive before the navigator has mounted, so the path is
 * kept and opened once `markNavigationReady` is called. Only the newest waiting path is kept.
 */
let ready = false;
let pending: string | null = null;

const open = (path: string): void => {
  try {
    router.navigate(path as never);
  } catch {
    // A path that matches no screen must never crash the app.
  }
};

export const openPath = (path: string): void => {
  if (ready) {
    open(path);
  } else {
    pending = path;
  }
};

export const markNavigationReady = (): void => {
  ready = true;
  if (pending !== null) {
    const path = pending;
    pending = null;
    open(path);
  }
};

/** Turns a "trackaexpense://split/invitations" style link into "/split/invitations". */
export const pathFromLink = (link: string): string => {
  const withoutScheme = link.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  return `/${withoutScheme.replace(/^\/+/, '')}`;
};
