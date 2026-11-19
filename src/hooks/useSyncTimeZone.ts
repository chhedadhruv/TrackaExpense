import {useEffect, useRef} from 'react';
import {useUserData} from '../data/hooks';
import {reportError} from '../services/ErrorReporter';
import {saveTimeZone} from '../services/TimeZoneService';
import {readDeviceTimeZone, timeZoneToSave} from '../utils/timeZone';

/**
 * Keeps `users/{uid}.timeZone` equal to the device's zone, so the scheduled jobs in functions/ use
 * the person's own local time. Writes once the profile listener has confirmed the profile (not
 * from a saved copy), and only when the zone differs from the saved one, so a normal launch writes
 * nothing. A failed write is tried again the next time the profile changes or the app starts.
 * Mounted by DataSync, so it runs only while someone is signed in.
 */
export const useSyncTimeZone = (): void => {
  const {data, live} = useUserData();
  const hasProfile = data !== undefined;
  const saved = data?.timeZone;
  const lastTried = useRef<string | null>(null);

  useEffect(() => {
    if (!live || !hasProfile) {
      return;
    }
    const zone = timeZoneToSave(readDeviceTimeZone(), saved);
    if (zone === null || zone === lastTried.current) {
      return;
    }
    lastTried.current = zone;
    saveTimeZone(zone).catch(error => {
      lastTried.current = null;
      reportError(error as Error);
    });
  }, [live, hasProfile, saved]);
};
