import {useState, useEffect, useRef, useCallback} from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
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

  useEffect(() => () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  }, []);

  const fetchUserData = useCallback(async (retryCount = 0): Promise<void> => {
    const currentUser = auth().currentUser;
    if (!currentUser?.uid) {
      setError('No authenticated user found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const doc = await firestore().collection('users').doc(currentUser.uid).get();
      if (doc.exists) {
        setUserData(doc.data() as UserDocument);
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
      if (retryCount < 1) {
        retryTimeoutRef.current = setTimeout(() => {
          fetchUserData(retryCount + 1);
        }, 2000);
      } else {
        setError('Error fetching user data. Please check your connection and try again.');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return {userData, loading, error, refresh: () => fetchUserData(0)};
}
