/**
 * Rules for "is the phone online", free of React and of the native module so they can be tested.
 *
 * NetInfo reports `isConnected` (a network is attached) and `isInternetReachable` (a probe got
 * through, `null` while it is still unknown). The phone counts as offline only when NetInfo says
 * so: no network, or the probe failed. An unknown probe is treated as online, so a slow start
 * never shows the offline banner.
 */

export interface NetworkState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

export const isOnlineState = (state: NetworkState): boolean => {
  if (state.isConnected === false) {
    return false;
  }
  if (state.isInternetReachable === false) {
    return false;
  }
  return true;
};

/** How long the phone must stay offline before the banner shows, so a blip does not flicker. */
export const OFFLINE_BANNER_DELAY_MS = 2000;
