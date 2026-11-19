import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {authenticate, getLockAvailability} from '../services/AppLockService';
import {
  LOCK_STORAGE_KEY,
  parseLockSetting,
  shouldLockOnForeground,
} from '../utils/appLock';
import {consumeLockSuppression} from './suppress';

export interface AppLockContextValue {
  /** What the person chose (saved on this phone). */
  enabled: boolean;
  /** True while the lock screen must cover the app. */
  locked: boolean;
  /** Shows the system prompt and unlocks on success. True when the person passed. */
  unlock: () => Promise<boolean>;
  /** Lifts the lock without a prompt (nobody is signed in, so there is nothing to protect). */
  release: () => void;
  /**
   * Turns the lock on or off. Both directions ask the person to pass the system prompt first, so
   * the lock cannot be switched on into something they cannot open, or off by someone else.
   * Resolves to 'unavailable' when the phone has no screen lock, 'cancelled' when the prompt was
   * not passed, 'ok' otherwise.
   */
  setEnabled: (next: boolean) => Promise<'ok' | 'cancelled' | 'unavailable'>;
}

const noop = async () => false;

export const AppLockContext = createContext<AppLockContextValue>({
  enabled: false,
  locked: false,
  unlock: noop,
  release: () => {},
  setEnabled: async () => 'unavailable',
});

interface AppLockProviderProps {
  children: ReactNode;
}

/**
 * Holds the app lock (src/utils/appLock.ts has the rules). The saved setting is read before the
 * children render, while the splash screen is still up, so a locked app never flashes its content.
 * It starts locked when the setting is on, and locks again when the app comes back from the
 * background after the grace period.
 */
export const AppLockProvider = ({children}: AppLockProviderProps) => {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);

  // Refs so the AppState listener always sees the current values without resubscribing.
  const enabledRef = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  // True while a system prompt is open: on some phones it moves the app through AppState changes.
  const prompting = useRef(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LOCK_STORAGE_KEY)
      .then(stored => {
        if (!active) {
          return;
        }
        const on = parseLockSetting(stored);
        enabledRef.current = on;
        setEnabledState(on);
        setLocked(on);
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') {
        return;
      }
      if (prompting.current) {
        // Our own system prompt moved the app around: not a trip to the background.
        backgroundedAt.current = null;
        return;
      }
      const left = backgroundedAt.current;
      backgroundedAt.current = null;
      // The flag is read and cleared on every return, so it never carries over to a later trip.
      const suppressed = consumeLockSuppression();
      if (
        shouldLockOnForeground({
          enabled: enabledRef.current,
          backgroundedAt: left,
          now: Date.now(),
          suppressed,
        })
      ) {
        setLocked(true);
      }
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  const prompt = useCallback(async (message: string) => {
    prompting.current = true;
    try {
      return await authenticate(message);
    } finally {
      prompting.current = false;
    }
  }, []);

  const unlock = useCallback(async () => {
    const passed = await prompt('Unlock TrackaExpense');
    if (passed) {
      setLocked(false);
    }
    return passed;
  }, [prompt]);

  const release = useCallback(() => setLocked(false), []);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (next) {
        const {available} = await getLockAvailability();
        if (!available) {
          return 'unavailable' as const;
        }
      }
      const passed = await prompt(
        next ? 'Confirm to turn on app lock' : 'Confirm to turn off app lock',
      );
      if (!passed) {
        return 'cancelled' as const;
      }
      enabledRef.current = next;
      setEnabledState(next);
      // The person just passed the prompt, so the app is not locked behind them.
      setLocked(false);
      AsyncStorage.setItem(LOCK_STORAGE_KEY, next ? 'true' : 'false').catch(
        () => {},
      );
      return 'ok' as const;
    },
    [prompt],
  );

  const value = useMemo<AppLockContextValue>(
    () => ({enabled, locked, unlock, release, setEnabled}),
    [enabled, locked, unlock, release, setEnabled],
  );

  if (!loaded) {
    return null;
  }
  return (
    <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
  );
};

/** The app lock: the setting, whether it is covering the app, and how to open or change it. */
export const useAppLock = (): AppLockContextValue => useContext(AppLockContext);
