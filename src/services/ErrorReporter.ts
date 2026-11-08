import * as Sentry from '@sentry/react-native';
import crashlytics from '@react-native-firebase/crashlytics';
import {SENTRY_DSN} from '@env';

/**
 * Starts Sentry. Does nothing when no DSN is configured, so local builds without the key still run.
 * Privacy: only the Firebase uid is attached to events. No email, name or IP address.
 */
export const initErrorReporting = (): void => {
  if (!SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    beforeSend: event => {
      if (event.user) {
        event.user = event.user.id ? {id: event.user.id} : undefined;
      }
      return event;
    },
  });
};

/** Attaches the Firebase uid (and nothing else) to future events; pass null on sign-out. */
export const setErrorReportingUser = (uid: string | null): void => {
  Sentry.setUser(uid ? {id: uid} : null);
};

/**
 * Reports a handled error. Sent to Sentry, and also to Crashlytics while both run side by side.
 * Never throws.
 */
export const reportError = (
  error: unknown,
  context?: Record<string, string>,
): void => {
  try {
    Sentry.withScope(scope => {
      if (context) {
        scope.setContext('details', context);
      }
      Sentry.captureException(error);
    });
  } catch (_) {
    // reporting must never break the app
  }
  try {
    crashlytics().recordError(
      error instanceof Error ? error : new Error(String(error)),
    );
  } catch (_) {
    // reporting must never break the app
  }
};

export const wrapWithErrorReporting = Sentry.wrap;
