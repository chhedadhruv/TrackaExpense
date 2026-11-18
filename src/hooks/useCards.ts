import {useCallback} from 'react';
import {useIsRestoring, useQuery, useQueryClient} from '@tanstack/react-query';
import {useUid} from '../data/hooks';
import {queryKeys} from '../data/keys';
import {reportError} from '../services/ErrorReporter';
import {
  archiveCard,
  deleteCard,
  loadCardPayments,
  loadCards,
  payBill,
  saveCard,
  undoBillPayment,
  type CardPaymentDocument,
} from '../services/CardService';
import type {CardDocument, CardInput} from '../utils/cards';
import type {CardPeriod} from '../utils/cardPeriods';

export interface ListResult<T> {
  data: T[] | undefined;
  /** True until there is something to show. */
  loading: boolean;
  /** True only when the read failed and there is nothing to show. */
  error: boolean;
  refetch: () => Promise<unknown>;
}

/**
 * Cards and card payments are small ordinary queries (not live listeners), read again every time
 * a screen that shows them opens and after every change made here. Not saved to the phone: what
 * each card owes is computed from the cached transactions.
 */
const useOwnerList = <T>(
  key: readonly unknown[],
  load: (uid: string) => Promise<T[]>,
): ListResult<T> => {
  const uid = useUid();
  const restoring = useIsRestoring();
  const result = useQuery<T[]>({
    queryKey: key,
    enabled: uid !== '',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        return await load(uid);
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

export const useCards = (): ListResult<CardDocument> => {
  const uid = useUid();
  return useOwnerList(queryKeys.cards(uid), loadCards);
};

export const useCardPayments = (): ListResult<CardPaymentDocument> => {
  const uid = useUid();
  return useOwnerList(queryKeys.cardPayments(uid), loadCardPayments);
};

/** The card change and payment actions; each reads the lists again when it is done. */
export const useCardActions = () => {
  const uid = useUid();
  const queryClient = useQueryClient();
  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({queryKey: queryKeys.cards(uid)}),
        queryClient.invalidateQueries({queryKey: queryKeys.cardPayments(uid)}),
      ]),
    [uid, queryClient],
  );

  return {
    save: useCallback(
      async (id: string | null, data: CardInput) => {
        const saved = await saveCard(uid, id, data);
        await refresh();
        return saved;
      },
      [uid, refresh],
    ),
    archive: useCallback(
      async (id: string) => {
        await archiveCard(uid, id);
        await refresh();
      },
      [uid, refresh],
    ),
    remove: useCallback(
      async (id: string) => {
        await deleteCard(uid, id);
        await refresh();
      },
      [uid, refresh],
    ),
    pay: useCallback(
      async (
        card: Pick<CardDocument, 'id' | 'name' | 'currency'>,
        period: CardPeriod,
        amountMinor: number,
        statementMinor: number | null,
      ) => {
        await payBill(uid, card, period, amountMinor, statementMinor);
        await refresh();
      },
      [uid, refresh],
    ),
    undo: useCallback(
      async (paymentId: string) => {
        await undoBillPayment(uid, paymentId);
        await refresh();
      },
      [uid, refresh],
    ),
  };
};
