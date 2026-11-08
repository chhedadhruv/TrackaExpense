import {Platform} from 'react-native';
import {LogLevel, OneSignal} from 'react-native-onesignal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import {ONESIGNAL_APP_ID} from '@env';

const PROMPTED_KEY = 'push_permission_prompted';

/**
 * Starts OneSignal. This does NOT ask for notification permission; the prompt is deferred until
 * after the user saves their first expense (see requestPushPermissionAfterFirstExpense).
 * Does nothing when no app id is configured.
 */
export const initPush = (): void => {
  if (!ONESIGNAL_APP_ID) {
    return;
  }
  try {
    if (__DEV__) {
      // Verbose SDK logging in debug builds only; must be set before initialize.
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    }
    OneSignal.initialize(ONESIGNAL_APP_ID);
  } catch (_) {}
};

/** Links this device to the Firebase uid. Messages are sent to the uid, never to raw tokens. */
export const loginPush = (uid: string, currency?: string): void => {
  if (!ONESIGNAL_APP_ID) {
    return;
  }
  try {
    OneSignal.login(uid);
    OneSignal.User.addTags({
      platform: Platform.OS,
      app_version: Application.nativeApplicationVersion ?? 'unknown',
      ...(currency ? {currency} : {}),
    });
  } catch (_) {}
};

/** Tags the device with the user's currency (a non-identifying segment). */
export const setPushCurrency = (currency: string): void => {
  if (!ONESIGNAL_APP_ID) {
    return;
  }
  try {
    OneSignal.User.addTag('currency', currency);
  } catch (_) {}
};

export const logoutPush = (): void => {
  if (!ONESIGNAL_APP_ID) {
    return;
  }
  try {
    OneSignal.logout();
  } catch (_) {}
};

/**
 * Asks for notification permission once, right after the first saved expense, when the value of
 * notifications is clear to the user. Later calls do nothing.
 */
export const requestPushPermissionAfterFirstExpense =
  async (): Promise<void> => {
    if (!ONESIGNAL_APP_ID) {
      return;
    }
    try {
      if ((await AsyncStorage.getItem(PROMPTED_KEY)) === 'true') {
        return;
      }
      await AsyncStorage.setItem(PROMPTED_KEY, 'true');
      await OneSignal.Notifications.requestPermission(true);
    } catch (_) {}
  };
