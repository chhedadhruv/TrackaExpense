import {useState, useCallback} from 'react';
import firestore from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import type {SavingsGoal} from '../types';

interface UseSavingsReturn {
  goals: SavingsGoal[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches the current user's savings goals.
 * Call `refetch` inside useFocusEffect to refresh on screen focus.
 */
export function useSavings(): UseSavingsReturn {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    const currentUser = getAuth().currentUser;
    if (!currentUser?.uid) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const snapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('savings')
        .get();

      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<SavingsGoal, 'id'>),
      })) as SavingsGoal[];

      setGoals(docs);
    } catch (err) {
      setError('Error fetching savings goals');
    } finally {
      setLoading(false);
    }
  }, []);

  return {goals, loading, error, refetch};
}
