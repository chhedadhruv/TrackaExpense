import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * An invite link opened while nobody is signed in. The sign-in screens replace the app screens, so
 * the link would be lost; it is kept (in memory and on the phone, because creating an account means
 * leaving the app to confirm the email) and opened right after sign-in. It is forgotten after a
 * day, and once it has been used.
 */

const KEY = 'pendingInvitePath';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

let memory: {path: string; at: number} | null = null;

export const savePendingInvite = async (
  path: string,
  now: number = Date.now(),
): Promise<void> => {
  memory = {path, at: now};
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // The copy in memory still serves a person who signs in without closing the app.
  }
};

/** The kept path if there is a recent one, and forgets it either way. */
export const takePendingInvite = async (
  now: number = Date.now(),
): Promise<string | null> => {
  let saved = memory;
  memory = null;
  if (saved === null) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      saved = raw ? (JSON.parse(raw) as {path: string; at: number}) : null;
    } catch {
      saved = null;
    }
  }
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
  if (
    saved === null ||
    typeof saved.path !== 'string' ||
    typeof saved.at !== 'number' ||
    now - saved.at > MAX_AGE_MS
  ) {
    return null;
  }
  return saved.path;
};
