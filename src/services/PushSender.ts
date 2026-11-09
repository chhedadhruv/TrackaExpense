import {getApp} from '@react-native-firebase/app';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';

/**
 * Sending a push notification to other people. The `sendPush` Cloud Function checks who may be
 * notified (the caller, and the members and pending invitees of one of the caller's groups),
 * sends through OneSignal by uid, and keeps an in-app copy if delivery fails. The app never
 * reads another user's token and never holds a push key.
 */

export interface SendPushArgs {
  emails: string[];
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** The group the recipients belong to; leave out when notifying only the signed-in user. */
  groupId?: string;
  icon?: string;
  priority?: string;
}

export interface SendPushResult {
  sent: boolean;
  stored: boolean;
  recipients: number;
  skipped: number;
}

export const sendPush = async (args: SendPushArgs): Promise<SendPushResult> => {
  const call = httpsCallable<SendPushArgs, SendPushResult>(
    getFunctions(getApp(), 'asia-south1'),
    'sendPush',
  );
  return (await call(args)).data;
};
