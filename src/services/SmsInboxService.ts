import {PermissionsAndroid, Platform} from 'react-native';
import {createMMKV} from 'react-native-mmkv';
import SmsInbox from '../../modules/sms-inbox';
import {
  addHandled,
  MAX_READ,
  offersFrom,
  sinceFor,
  type SmsOffer,
} from '../utils/smsInbox';

/**
 * Reads the phone's inbox for bank messages (Android only). The permission is asked only after
 * the in-app disclosure, never before. Messages are read and parsed on the phone and never sent
 * anywhere; the phone keeps only a list of hashed ids of messages already handled.
 */

const store = createMMKV({id: 'sms-inbox'});
const handledKey = (uid: string) => `handled:${uid}`;
const consentKey = (uid: string) => `consent:${uid}`;

export type InboxPermission = 'granted' | 'denied' | 'blocked';

/** True only on Android with the native module present. */
export const isInboxSupported = (): boolean =>
  Platform.OS === 'android' && SmsInbox !== null;

export const hasInboxPermission = async (): Promise<boolean> =>
  Platform.OS === 'android' &&
  (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS));

/** Whether the person has accepted the disclosure on this phone. */
export const hasDisclosureConsent = (uid: string): boolean =>
  store.getBoolean(consentKey(uid)) === true;

export const recordDisclosureConsent = (uid: string): void =>
  store.set(consentKey(uid), true);

/** Shows the system prompt. Call it only after the person accepted the disclosure. */
export const requestInboxPermission = async (): Promise<InboxPermission> => {
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  );
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  }
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ? 'blocked'
    : 'denied';
};

const readHandled = (uid: string): string[] => {
  try {
    const raw = store.getString(handledKey(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
};

/** Marks messages as handled (added, or dismissed) so they are not offered again. */
export const markHandled = (uid: string, ids: readonly string[]): void => {
  store.set(handledKey(uid), JSON.stringify(addHandled(readHandled(uid), ids)));
};

/** Forgets what was handled and the consent, for a person who turns the reader off. */
export const resetInbox = (uid: string): void => {
  store.remove(handledKey(uid));
  store.remove(consentKey(uid));
};

/** Bank payments and deposits of the last 30 days that were not handled yet, newest first. */
export const loadOffers = async (uid: string): Promise<SmsOffer[]> => {
  if (SmsInbox === null) {
    return [];
  }
  const messages = await SmsInbox.readNamedSenderMessages(
    sinceFor(Date.now()),
    MAX_READ,
  );
  return offersFrom(messages, new Set(readHandled(uid)));
};
