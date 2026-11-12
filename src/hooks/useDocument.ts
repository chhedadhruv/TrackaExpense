import {useCallback, useRef, useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {doc, getDoc, getFirestore} from '@react-native-firebase/firestore';
import {reportError} from '../services/ErrorReporter';

export type DocumentState<T> =
  | {status: 'loading'}
  | {status: 'ready'; data: T}
  | {status: 'missing'}
  | {status: 'error'};

/**
 * Reads one Firestore document by its path segments (for example
 * ['users', uid, 'transactions', id]) and returns it with its id. A screen opened by id uses this
 * instead of receiving the whole document as a route parameter, because route parameters are
 * plain text. The document is read again each time the screen comes back into focus (after an
 * edit, for instance); the first read shows the loading state, later ones keep the old data on
 * screen until the new data arrives.
 */
export const useDocument = <T extends object>(
  segments: readonly string[] | null,
): {state: DocumentState<T>; reload: () => void} => {
  const [state, setState] = useState<DocumentState<T>>({status: 'loading'});
  const hasData = useRef(false);
  // The last document as text: a re-read that finds nothing changed keeps the same object, so a
  // form whose effects depend on it is not reset.
  const lastJson = useRef<string | null>(null);
  const key = segments ? segments.join('/') : '';

  const load = useCallback(async () => {
    if (!segments || segments.some(part => !part)) {
      setState({status: 'missing'});
      return;
    }
    try {
      const [first, ...rest] = segments;
      const snapshot = await getDoc(
        doc(getFirestore(), first, ...(rest as [string, ...string[]])),
      );
      if (!snapshot.exists()) {
        hasData.current = false;
        lastJson.current = null;
        setState({status: 'missing'});
        return;
      }
      const data = {id: snapshot.id, ...snapshot.data()} as unknown as T;
      const json = JSON.stringify(data);
      hasData.current = true;
      if (json === lastJson.current) {
        return;
      }
      lastJson.current = json;
      setState({status: 'ready', data});
    } catch (e) {
      reportError(e as Error);
      // A failed refresh must not hide data that is already on screen.
      if (!hasData.current) {
        setState({status: 'error'});
      }
    }
    // The segments are read through `key` so a new array each render does not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const reload = useCallback(() => {
    setState(previous =>
      previous.status === 'ready' ? previous : {status: 'loading'},
    );
    load();
  }, [load]);

  return {state, reload};
};
