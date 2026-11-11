import {Mixpanel} from 'mixpanel-react-native';
import {MIXPANEL_TOKEN} from '@env';
import {isServiceEnabled} from '../utils/serviceGate';

type Properties = Record<string, string | number | boolean>;

let mixpanel: Mixpanel | null = null;

/**
 * Starts Mixpanel. Does nothing in a development build or when no token is configured: the
 * instance stays null, so every call below is a no-op and no event leaves a dev build.
 * Privacy: events carry no email or name; the user is identified by the Firebase uid only.
 */
export const initMixpanel = async (): Promise<void> => {
  if (!isServiceEnabled(MIXPANEL_TOKEN, __DEV__) || mixpanel) {
    return;
  }
  try {
    const instance = new Mixpanel(MIXPANEL_TOKEN, false);
    await instance.init();
    instance.setUseIpAddressForGeolocation(false);
    instance.registerSuperProperties({app: 'TrackaExpense'});
    mixpanel = instance;
  } catch (_) {
    mixpanel = null;
  }
};

/** Sends one event. Only names from the approved event list may be used. */
export const track = (event: string, properties?: Properties): void => {
  try {
    mixpanel?.track(event, properties);
  } catch (_) {
    // analytics must never break the app
  }
};

export const identifyUser = (uid: string): void => {
  try {
    mixpanel?.identify(uid);
  } catch (_) {}
};

export const setUserProperties = (properties: Properties): void => {
  try {
    mixpanel?.getPeople().set(properties);
  } catch (_) {}
};

/** Call on logout so the next person on the device is not linked to this user. */
export const resetMixpanel = (): void => {
  try {
    mixpanel?.reset();
  } catch (_) {}
};
