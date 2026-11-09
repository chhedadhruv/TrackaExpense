import type {Firestore} from 'firebase-admin/firestore';

/**
 * Finding other users by email or phone, without exposing their profile documents.
 *
 * Today every signed-in client reads other users' `users` documents to resolve an email into a
 * uid, name and avatar. Strict rules will make `users/{uid}` owner-only, so this is the only door:
 * it returns the four fields the screens use and nothing else (no phone, balance, FCM token,
 * savings or any other profile data).
 */

export const MAX_LOOKUP_ITEMS = 30;

export interface LookupInput {
  emails?: unknown;
  phones?: unknown;
}

export interface FoundUser {
  uid: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export interface LookupResult {
  /** One entry per requested email, in order: the user, or null when there is no account. */
  emails: Array<FoundUser | null>;
  /** One entry per requested phone, in order. */
  phones: Array<FoundUser | null>;
}

export class LookupInputError extends Error {}

const asStringList = (value: unknown, name: string): string[] => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new LookupInputError(`${name} must be a list of strings`);
  }
  return value.map(item => {
    if (typeof item !== 'string') {
      throw new LookupInputError(`${name} must be a list of strings`);
    }
    return item.trim();
  });
};

/** Validates the request: only string lists, at most MAX_LOOKUP_ITEMS entries in total. */
export const parseLookupInput = (
  input: unknown,
): {emails: string[]; phones: string[]} => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new LookupInputError('expected an object with emails and/or phones');
  }
  const data = input as LookupInput;
  const emails = asStringList(data.emails, 'emails');
  const phones = asStringList(data.phones, 'phones');
  if (emails.length + phones.length > MAX_LOOKUP_ITEMS) {
    throw new LookupInputError(
      `at most ${MAX_LOOKUP_ITEMS} lookups per request`,
    );
  }
  return {emails, phones};
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const findOne = async (
  db: Firestore,
  field: 'email' | 'phone',
  value: string,
): Promise<FoundUser | null> => {
  if (value === '') {
    return null;
  }
  const result = await db
    .collection('users')
    .where(field, '==', value)
    .limit(1)
    .get();
  if (result.empty) {
    return null;
  }
  const doc = result.docs[0];
  return {
    uid: doc.id,
    email: text(doc.get('email')) ?? value,
    // The app has used `name`, falling back to `displayName`, wherever it shows a member.
    name: text(doc.get('name')) ?? text(doc.get('displayName')),
    avatar: text(doc.get('avatar')),
  };
};

/** Same matching the screens used: the exact text first, then the lower-case form of an email. */
const findByEmail = async (
  db: Firestore,
  email: string,
): Promise<FoundUser | null> => {
  const exact = await findOne(db, 'email', email);
  if (exact || email === email.toLowerCase()) {
    return exact;
  }
  return findOne(db, 'email', email.toLowerCase());
};

export const lookupUsers = async (
  db: Firestore,
  input: unknown,
): Promise<LookupResult> => {
  const {emails, phones} = parseLookupInput(input);
  return {
    emails: await Promise.all(emails.map(email => findByEmail(db, email))),
    phones: await Promise.all(phones.map(phone => findOne(db, 'phone', phone))),
  };
};
