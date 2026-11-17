import {useCallback} from 'react';
import {useIsRestoring, useQuery, useQueryClient} from '@tanstack/react-query';
import {useUid} from '../data/hooks';
import {queryKeys} from '../data/keys';
import {reportError} from '../services/ErrorReporter';
import {
  deleteRecurring,
  loadRecurring,
  saveRecurring,
  type RecurringInput,
} from '../services/RecurringService';
import type {RecurringDocument} from '../utils/recurring';

export interface RecurringResult {
  data: RecurringDocument[] | undefined;
  /** True until there is something to show. */
  loading: boolean;
  /** True only when the read failed and there is nothing to show. */
  error: boolean;
  refetch: () => Promise<unknown>;
}

/**
 * The user's recurring rules. An ordinary query, read again every time a screen that shows them
 * opens (the server moves a rule's next date while the app is closed) and after every save or
 * delete here. Not saved to the phone.
 */
export const useRecurring = (): RecurringResult => {
  const uid = useUid();
  const restoring = useIsRestoring();
  const result = useQuery<RecurringDocument[]>({
    queryKey: queryKeys.recurring(uid),
    enabled: uid !== '',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        return await loadRecurring(uid);
      } catch (error) {
        reportError(error as Error);
        throw error;
      }
    },
  });
  const empty = result.data === undefined;
  return {
    data: result.data,
    loading: empty && (restoring || result.isPending),
    error: empty && !restoring && result.isError,
    refetch: result.refetch,
  };
};

/** Saves (id null creates) a rule, then reads the list again. Rejects when the write fails. */
export const useSaveRecurring = () => {
  const uid = useUid();
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string | null, data: RecurringInput) => {
      const saved = await saveRecurring(uid, id, data);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurring(uid),
      });
      return saved;
    },
    [uid, queryClient],
  );
};

/** Deletes a rule, then reads the list again. */
export const useDeleteRecurring = () => {
  const uid = useUid();
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string) => {
      await deleteRecurring(uid, id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurring(uid),
      });
    },
    [uid, queryClient],
  );
};
