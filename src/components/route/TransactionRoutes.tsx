import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import {EmptyState, ErrorState, LoadingState} from '../ScreenState';
import TransactionDetailScreen from '../../../screens/TransactionDetailScreen';
import EditTransactionScreen from '../../../screens/EditTransactionScreen';
import {useTransactionById} from '../../data/hooks';

/**
 * Opens a transaction by id from the shared cache of the person's transactions (src/data), so the
 * detail and edit screens cost no extra Firestore read and show an edit or delete at once.
 * `basePath` is "" for the Home tab and "/statistic" for the Statistic tab.
 */
const useRouteTransaction = () => {
  const {id} = useLocalSearchParams<{id: string}>();
  return useTransactionById(id);
};

const NotFound = () => (
  <EmptyState
    fill
    title="Transaction not found"
    message="It may have been deleted."
  />
);

export const TransactionDetailRoute = ({basePath}: {basePath: string}) => {
  const {data, loading, error, retry} = useRouteTransaction();
  if (data) {
    return <TransactionDetailScreen transaction={data} basePath={basePath} />;
  }
  if (loading) {
    return <LoadingState message="Loading…" />;
  }
  return error ? <ErrorState onRetry={retry} /> : <NotFound />;
};

export const EditTransactionRoute = ({basePath}: {basePath: string}) => {
  const {data, loading, error, retry} = useRouteTransaction();
  if (data) {
    return <EditTransactionScreen transaction={data} basePath={basePath} />;
  }
  if (loading) {
    return <LoadingState message="Loading…" />;
  }
  return error ? <ErrorState onRetry={retry} /> : <NotFound />;
};
