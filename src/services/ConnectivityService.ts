import NetInfo from '@react-native-community/netinfo';
import {create} from 'zustand';
import {isOnlineState} from '../utils/connectivity';

/**
 * The app's one view of connectivity. `startConnectivity` is called once from the root layout and
 * keeps `online` current; screens read it through `useIsOnline`, services through `isOnline`.
 */
interface ConnectivityStore {
  online: boolean;
}

export const useConnectivityStore = create<ConnectivityStore>(() => ({
  online: true,
}));

export const useIsOnline = (): boolean =>
  useConnectivityStore(state => state.online);

export const isOnline = (): boolean => useConnectivityStore.getState().online;

/** Starts listening. Returns the function that stops it. */
export const startConnectivity = (): (() => void) =>
  NetInfo.addEventListener(state => {
    useConnectivityStore.setState({online: isOnlineState(state)});
  });
