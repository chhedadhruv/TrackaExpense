import {getApp} from '@react-native-firebase/app';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';

/**
 * Finding other users by email or phone. Goes through the `lookupUsersByContact` Cloud Function,
 * which returns only the four fields below. Screens must not read other users' `users` documents
 * directly: those become owner-only with the stage 2 rules.
 */

export interface FoundUser {
  uid: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

interface LookupResponse {
  emails: Array<FoundUser | null>;
  phones: Array<FoundUser | null>;
}

// Keep in step with MAX_LOOKUP_ITEMS in functions/src/lookup.ts.
const CHUNK = 30;

const callLookup = httpsCallable<
  {emails?: string[]; phones?: string[]},
  LookupResponse
>(getFunctions(getApp(), 'asia-south1'), 'lookupUsersByContact');

const chunked = <T>(items: T[]): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    chunks.push(items.slice(i, i + CHUNK));
  }
  return chunks;
};

/** One entry per email, in order; null where there is no account. Throws if the call fails. */
export const lookupUsersByEmail = async (
  emails: string[],
): Promise<Array<FoundUser | null>> => {
  const results: Array<FoundUser | null> = [];
  for (const part of chunked(emails)) {
    const response = await callLookup({emails: part});
    results.push(...response.data.emails);
  }
  return results;
};

export const lookupUserByEmail = async (
  email: string,
): Promise<FoundUser | null> => (await lookupUsersByEmail([email]))[0] ?? null;

export const lookupUserByPhone = async (
  phone: string,
): Promise<FoundUser | null> => {
  const response = await callLookup({phones: [phone]});
  return response.data.phones[0] ?? null;
};
