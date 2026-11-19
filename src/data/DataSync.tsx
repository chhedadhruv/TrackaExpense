import {useEffect} from 'react';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import {reportError} from '../services/ErrorReporter';
import {useSyncTimeZone} from '../hooks/useSyncTimeZone';
import type {TransactionDocument, UserDocument} from '../types';
import {queryKeys} from './keys';
import {queryClient} from './queryClient';
import {useSyncStore} from './syncStore';

/**
 * Keeps the query cache current while someone is signed in: one live listener on the person's
 * profile and one on their transactions, started once and shared by every screen. Home, the
 * Transactions list and Statistics used to open their own reads of the same collection; now they
 * read the cache. Every write the app makes (add, edit, delete) reaches the cache through these
 * listeners, so no screen has to refetch.
 *
 * Renders nothing. Mounted by AuthGate while a user is signed in.
 */
const DataSync = ({uid}: {uid: string}) => {
  const restartKey = useSyncStore(state => state.restartKey);
  useSyncTimeZone();

  useEffect(() => {
    const {setStatus} = useSyncStore.getState();
    setStatus('user', 'loading');
    setStatus('transactions', 'loading');
    const db = getFirestore();

    const unsubscribeUser = onSnapshot(
      doc(db, 'users', uid),
      snapshot => {
        if (snapshot.exists()) {
          queryClient.setQueryData(
            queryKeys.user(uid),
            snapshot.data() as UserDocument,
          );
        }
        setStatus('user', 'live');
      },
      error => {
        reportError(error);
        setStatus('user', 'error');
      },
    );

    const unsubscribeTransactions = onSnapshot(
      query(
        collection(db, 'users', uid, 'transactions'),
        orderBy('createdAt', 'desc'),
      ),
      snapshot => {
        const transactions = snapshot.docs.map(document => ({
          id: document.id,
          userId: uid,
          ...document.data(),
        })) as TransactionDocument[];
        queryClient.setQueryData(queryKeys.transactions(uid), transactions);
        setStatus('transactions', 'live');
      },
      error => {
        reportError(error);
        setStatus('transactions', 'error');
      },
    );

    return () => {
      unsubscribeUser();
      unsubscribeTransactions();
    };
  }, [uid, restartKey]);

  return null;
};

export default DataSync;
