import {useState, useCallback} from 'react';
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import type {SplitDocument} from '../types';

interface UseSplitsOptions {
  groupId?: string;
}

interface UseSplitsReturn {
  splits: SplitDocument[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches splits for a given group, ordered by date descending.
 * Always uses the `split.date ?? split.createdAt` fallback for legacy records.
 */
export function useSplits({groupId}: UseSplitsOptions): UseSplitsReturn {
  const [splits, setSplits] = useState<SplitDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    if (!groupId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const snapshot = await getDocs(
        query(
          collection(getFirestore(), 'groups', groupId, 'splits'),
          orderBy('date', 'desc'),
        ),
      );

      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<SplitDocument, 'id'>),
      })) as SplitDocument[];

      setSplits(docs);
    } catch (err) {
      setError('Error fetching splits');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  return {splits, loading, error, refetch};
}
