import {create} from 'zustand';

export type SyncStatus = 'loading' | 'live' | 'error';

interface SyncState {
  /** Where each live listener stands, by the id the listener was started with. */
  statuses: Record<string, SyncStatus>;
  /** Bumped by `retry` so every listener starts again. */
  restartKey: number;
  setStatus: (id: string, status: SyncStatus) => void;
  retry: () => void;
  reset: () => void;
}

/**
 * Where the live listeners stand. The data itself lives in the query cache; this only says
 * whether the first answer is still on its way, has arrived, or failed, which a screen needs to
 * choose between a spinner, its content and an error message. An id that has not reported yet
 * counts as loading.
 */
export const useSyncStore = create<SyncState>(set => ({
  statuses: {},
  restartKey: 0,
  setStatus: (id, status) =>
    set(state => ({statuses: {...state.statuses, [id]: status}})),
  retry: () => set(state => ({restartKey: state.restartKey + 1})),
  reset: () => set({statuses: {}}),
}));

/** The status of one listener id, `loading` until it reports. */
export const statusOf = (statuses: Record<string, SyncStatus>, id: string) =>
  statuses[id] ?? 'loading';
