import {Timestamp} from '@react-native-firebase/firestore';

/**
 * The cached data is saved as JSON, and a Firestore Timestamp does not survive that: it comes
 * back as a plain object without `toDate()`, which the screens call. These two functions turn
 * every Timestamp into a marked pair of numbers on the way out and back into a real Timestamp on
 * the way in, at any depth of the data.
 */

const MARK = '__firestoreTimestamp';

type Encoded = {[MARK]: [number, number]};

const isEncoded = (value: unknown): value is Encoded =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as Record<string, unknown>)[MARK]);

export const encodeTimestamps = (value: unknown): unknown => {
  if (value instanceof Timestamp) {
    return {[MARK]: [value.seconds, value.nanoseconds]};
  }
  if (Array.isArray(value)) {
    return value.map(encodeTimestamps);
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = encodeTimestamps((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
};

export const decodeTimestamps = (value: unknown): unknown => {
  if (isEncoded(value)) {
    const [seconds, nanoseconds] = value[MARK];
    return new Timestamp(seconds, nanoseconds);
  }
  if (Array.isArray(value)) {
    return value.map(decodeTimestamps);
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = decodeTimestamps((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
};
