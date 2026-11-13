/**
 * The decision part of over-the-air updates, kept free of native imports so it can be tested.
 *
 * Two behaviours are built on it (see src/navigation/AuthGate.tsx):
 * - Nobody is signed in: the splash screen stays up while the update is fetched, for at most
 *   SPLASH_UPDATE_TIMEOUT_MS, and the app restarts into it. If it does not arrive in time the
 *   sign-in screen opens and the update applies on the next start, as before.
 * - Someone is signed in: nothing waits. When the update has been downloaded a sheet offers a
 *   restart (src/components/UpdateSheet.tsx).
 */

export const SPLASH_UPDATE_TIMEOUT_MS = 5000;

/** The few expo-updates calls the flow needs (src/services/AppUpdate.ts is the real one). */
export interface UpdateApi {
  /** False in development builds and when updates are switched off. */
  isEnabled: boolean;
  /** Asks the server; true when there is an update newer than the running one. */
  check: () => Promise<boolean>;
  /** Downloads the update; true when a new one is ready to start. */
  fetch: () => Promise<boolean>;
  /** Restarts the app into the downloaded update. */
  reload: () => Promise<void>;
}

export type SplashUpdateOutcome =
  /** Updates are off (development build): nothing was asked. */
  | 'disabled'
  /** The server has nothing newer. */
  | 'none'
  /** The update was downloaded and the restart was requested. */
  | 'applied'
  /** Not ready in time. A download that is under way finishes and applies on the next start. */
  | 'timeout'
  /** The check, the download or the restart failed. */
  | 'failed';

/**
 * Fetches an update and restarts into it, giving up after `timeoutMs`. It never restarts after
 * the time is up: by then the caller has shown the sign-in screen, and a restart would interrupt
 * whoever is typing there. It never rejects.
 */
export const applyUpdateWithin = (
  api: UpdateApi,
  timeoutMs: number = SPLASH_UPDATE_TIMEOUT_MS,
): Promise<SplashUpdateOutcome> => {
  if (!api.isEnabled) {
    return Promise.resolve('disabled');
  }
  return new Promise<SplashUpdateOutcome>(resolve => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      resolve('timeout');
    }, timeoutMs);
    const finish = (outcome: SplashUpdateOutcome): void => {
      clearTimeout(timer);
      resolve(outcome);
    };

    (async () => {
      if (!(await api.check())) {
        return 'none' as const;
      }
      if (!(await api.fetch())) {
        return 'none' as const;
      }
      if (timedOut) {
        return 'timeout' as const;
      }
      await api.reload();
      return 'applied' as const;
    })().then(finish, () => finish('failed'));
  });
};

/**
 * Whether the restart sheet should be on screen: an update is downloaded, and the person has not
 * already chosen "Later" for that same update since the app started.
 */
export const shouldOfferRestart = (args: {
  isUpdatePending: boolean;
  downloadedUpdateId: string | null | undefined;
  dismissedUpdateId: string | null;
}): boolean => {
  if (!args.isUpdatePending) {
    return false;
  }
  // An update without an id cannot be told apart from the next one, so one "Later" covers it.
  const id = args.downloadedUpdateId ?? '';
  return args.dismissedUpdateId !== id;
};
