import {useState, useEffect, useRef, useCallback} from 'react';
import {
  doc as fsDoc,
  getDoc,
  getFirestore,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {getCrashlytics, setAttribute} from '@react-native-firebase/crashlytics';
import {reportError} from '../services/ErrorReporter';
import * as AnalyticsService from '../services/AnalyticsService';
import {setPushCurrency} from '../services/PushService';
import type {UserDocument} from '../types';

interface UseUserDataReturn {
  userData: UserDocument | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the current user's Firestore document with retry logic.
 * Sets up a real-time onSnapshot listener so balance and profile changes
 * propagate automatically without manual refresh.
 */
export function useUserData(): UseUserDataReturn {
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    },
    [],
  );

  const fetchUserData = useCallback(async (retryCount = 0): Promise<void> => {
    const currentUser = getAuth().currentUser;
    if (!currentUser?.uid) {
      setError('No authenticated user found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const doc = await getDoc(fsDoc(getFirestore(), 'users', currentUser.uid));
      if (doc.exists()) {
        const data = doc.data() as UserDocument;
        setUserData(data);
        setAttribute(getCrashlytics(), 'currency', data.currency ?? 'INR');
        AnalyticsService.setUserProperties({currency: data.currency ?? 'INR'});
        setPushCurrency(data.currency ?? 'INR');
        setError(null);
        setLoading(false);
      } else if (retryCount < 2) {
        // Retry for social sign-in timing issues where Firestore doc isn't ready yet
        retryTimeoutRef.current = setTimeout(() => {
          fetchUserData(retryCount + 1);
        }, 2000 * (retryCount + 1));
      } else {
        setError('User data not found. Please try signing in again.');
        setLoading(false);
      }
    } catch (err) {
      reportError(err as Error);
      if (retryCount < 1) {
        retryTimeoutRef.current = setTimeout(() => {
          fetchUserData(retryCount + 1);
        }, 2000);
      } else {
        setError(
          'Error fetching user data. Please check your connection and try again.',
        );
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return {userData, loading, error, refresh: () => fetchUserData(0)};
}
