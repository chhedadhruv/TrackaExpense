import {requireOptionalNativeModule} from 'expo-modules-core';
import type {RawSms} from '../../src/utils/smsInbox';

interface SmsInboxNative {
  readNamedSenderMessages(sinceMs: number, limit: number): Promise<RawSms[]>;
}

/** The Android inbox reader; null on iOS and in Jest, where the module does not exist. */
export default requireOptionalNativeModule<SmsInboxNative>('SmsInbox');
