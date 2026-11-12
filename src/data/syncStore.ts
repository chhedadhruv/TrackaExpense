import {create} from 'zustand';

export type SyncStatus = 'loading' | 'live' | 'error';

interface SyncState {
  user: SyncStatus;
  transactions: SyncStatus;
  /** Bumped by `retry` so DataSync starts its listeners again. */
  restartKey: number;
  setStatus: (kind: 'user' | 'transactions', status: SyncStatus) => void;
  retry: () => void;
  reset: () => void;
}

/**
 * Where the live listeners stand. The data itself lives in the query cache; this only says
 * whether the first answer is still on its way, has arrived, or failed, which a screen needs to
 * choose between a spinner, its content and an error message.
 */
export const useSyncStore = create<SyncState>(set => ({
  user: 'loading',
  transactions: 'loading',
  restartKey: 0,
  setStatus: (kind, status) => set({[kind]: status}),
  retry: () => set(state => ({restartKey: state.restartKey + 1})),
  reset: () => set({user: 'loading', transactions: 'loading'}),
}));
