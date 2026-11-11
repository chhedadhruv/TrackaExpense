import * as Sentry from '@sentry/react-native';
import {getCrashlytics, recordError} from '@react-native-firebase/crashlytics';
import {SENTRY_DSN} from '@env';
import {isServiceEnabled} from '../utils/serviceGate';

// Sentry runs in release builds only (see serviceGate). In a development build nothing is sent.
const sentryEnabled = isServiceEnabled(SENTRY_DSN, __DEV__);

/**
 * Starts Sentry. Does nothing in a development build or when no DSN is configured, so local
 * builds still run and do not send events.
 * Privacy: only the Firebase uid is attached to events. No email, name or IP address.
 */
export const initErrorReporting = (): void => {
  if (!sentryEnabled) {
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
  if (!sentryEnabled) {
    return;
  }
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
  if (__DEV__) {
    // Sentry is off in development, so show the error here instead of dropping it silently.
    console.warn('[reportError]', error, context ?? '');
  }
  if (sentryEnabled) {
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
  }
  try {
    recordError(
      getCrashlytics(),
      error instanceof Error ? error : new Error(String(error)),
    );
  } catch (_) {
    // reporting must never break the app
  }
};

// Sentry.wrap warns when Sentry was not initialised, so skip it when Sentry is off (dev builds).
export const wrapWithErrorReporting: typeof Sentry.wrap = sentryEnabled
  ? Sentry.wrap
  : component => component;
