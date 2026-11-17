import {useCallback} from 'react';
import {useIsRestoring, useQuery, useQueryClient} from '@tanstack/react-query';
import {useUid} from '../data/hooks';
import {queryKeys} from '../data/keys';
import {reportError} from '../services/ErrorReporter';
import {deleteBudget, loadBudgets, saveBudget} from '../services/BudgetService';
import type {BudgetDocument} from '../utils/budgets';

export interface BudgetsResult {
  data: BudgetDocument[] | undefined;
  /** True until there is something to show. */
  loading: boolean;
  /** True only when the read failed and there is nothing to show. */
  error: boolean;
  refetch: () => Promise<unknown>;
}

/**
 * The user's budgets. An ordinary query (not a live listener): read again every time a screen
 * that shows them opens, and after every save or delete here. Not saved to the phone: the list is
 * small and the progress shown next to it comes from the cached transactions.
 */
export const useBudgets = (): BudgetsResult => {
  const uid = useUid();
  const restoring = useIsRestoring();
  const result = useQuery<BudgetDocument[]>({
    queryKey: queryKeys.budgets(uid),
    enabled: uid !== '',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        return await loadBudgets(uid);
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

/** Saves (id null creates) a budget, then reads the list again. Rejects when the write fails. */
export const useSaveBudget = () => {
  const uid = useUid();
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string | null, data: Omit<BudgetDocument, 'id'>) => {
      const saved = await saveBudget(uid, id, data);
      await queryClient.invalidateQueries({queryKey: queryKeys.budgets(uid)});
      return saved;
    },
    [uid, queryClient],
  );
};

/** Deletes a budget, then reads the list again. Its past alerts stay as a record. */
export const useDeleteBudget = () => {
  const uid = useUid();
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string) => {
      await deleteBudget(uid, id);
      await queryClient.invalidateQueries({queryKey: queryKeys.budgets(uid)});
    },
    [uid, queryClient],
  );
};
