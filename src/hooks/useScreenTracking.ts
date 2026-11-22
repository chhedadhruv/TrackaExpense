import {useEffect, useRef} from 'react';
import {useSegments} from 'expo-router';
import * as AnalyticsService from '../services/AnalyticsService';
import {screenNameFromSegments} from '../utils/screenName';

/**
 * Sends one `Screen Viewed` event each time the visible route changes. Call it once, in the root
 * layout. The name comes from the route segments, never the real URL, so no ids are sent.
 */
export const useScreenTracking = (): void => {
  const segments = useSegments();
  const last = useRef<string | null>(null);
  const name = screenNameFromSegments(segments);

  useEffect(() => {
    if (name && name !== last.current) {
      last.current = name;
      AnalyticsService.logScreenViewed(name);
    }
  }, [name]);
};
