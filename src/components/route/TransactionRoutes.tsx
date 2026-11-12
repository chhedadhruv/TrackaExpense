import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import {getAuth} from '@react-native-firebase/auth';
import DocumentRoute from './DocumentRoute';
import TransactionDetailScreen from '../../../screens/TransactionDetailScreen';
import EditTransactionScreen from '../../../screens/EditTransactionScreen';
import type {TransactionDocument} from '../../types';

type LoadedTransaction = TransactionDocument & {id: string};

const useTransactionSegments = (): readonly string[] | null => {
  const {id} = useLocalSearchParams<{id: string}>();
  const uid = getAuth().currentUser?.uid;
  return uid && id ? ['users', uid, 'transactions', id] : null;
};

/** Opens a transaction by id. `basePath` is "" for the Home tab and "/statistic" for Statistic. */
export const TransactionDetailRoute = ({basePath}: {basePath: string}) => {
  const segments = useTransactionSegments();
  return (
    <DocumentRoute<LoadedTransaction>
      segments={segments}
      missingTitle="Transaction not found"
      render={transaction => (
        <TransactionDetailScreen
          transaction={transaction}
          basePath={basePath}
        />
      )}
    />
  );
};

export const EditTransactionRoute = ({basePath}: {basePath: string}) => {
  const segments = useTransactionSegments();
  return (
    <DocumentRoute<LoadedTransaction>
      segments={segments}
      missingTitle="Transaction not found"
      render={transaction => (
        <EditTransactionScreen transaction={transaction} basePath={basePath} />
      )}
    />
  );
};
