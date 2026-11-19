import {systemPathFor} from '../src/utils/inviteLinks';

/**
 * Expo Router calls this for every URL that opens the app, at launch and while it is running. A
 * verified Android App Link to the invite page
 * (https://trackaexpense.dhruvchheda.com/join#g=<group>&t=<token>) is rewritten to the app route
 * for the invite; everything else passes through (see `systemPathFor`). A throw here can crash
 * the app, so any failure falls back to the original URL.
 */
export function redirectSystemPath({path}: {path: string; initial: boolean}) {
  try {
    return systemPathFor(path);
  } catch {
    return path;
  }
}
