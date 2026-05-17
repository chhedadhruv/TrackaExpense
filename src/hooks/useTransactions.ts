import {useState, useCallback} from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import * as PerformanceService from '../services/PerformanceService';
import type {TransactionDocument} from '../types';

interface UseTransactionsReturn {
  transactions: TransactionDocument[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches the current user's transactions ordered by createdAt descending.
 * Call `refetch` inside useFocusEffect to refresh when navigating back.
 */
export function useTransactions(): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<TransactionDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    const currentUser = auth().currentUser;
    if (!currentUser?.uid) return;

    setLoading(true);
    setError(null);

    try {
      const stopTrace = await PerformanceService.traceFetchTransactions();
      const snapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('transactions')
        .get();
      await stopTrace?.();

      const docs = snapshot.docs.map(doc => ({
        documentId: doc.id,
        userId: currentUser.uid,
        ...(doc.data() as Omit<TransactionDocument, 'documentId' | 'userId'>),
      })) as TransactionDocument[];

      // Sort by createdAt descending
      docs.sort((a, b) => {
        const aSeconds = (a.createdAt as any)?.seconds ?? 0;
        const bSeconds = (b.createdAt as any)?.seconds ?? 0;
        return bSeconds - aSeconds;
      });

      setTransactions(docs);
    } catch (err) {
      crashlytics().recordError(err as Error);
      setError('Error fetching transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  return {transactions, loading, error, refetch};
}
