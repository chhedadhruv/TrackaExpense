import {describe, expect, it, jest} from '@jest/globals';

// The package entry needs the native Firebase module, which Jest does not have. The Timestamp
// class itself is plain TypeScript, so the real class is used.
jest.mock('@react-native-firebase/firestore', () => ({
  Timestamp: (
    jest.requireActual(
      '../node_modules/@react-native-firebase/firestore/lib/FirestoreTimestamp',
    ) as {Timestamp: unknown}
  ).Timestamp,
}));

import {Timestamp} from '@react-native-firebase/firestore';
import {decodeTimestamps, encodeTimestamps} from '../src/data/timestampCodec';

const roundTrip = (value: unknown): unknown =>
  decodeTimestamps(JSON.parse(JSON.stringify(encodeTimestamps(value))));

describe('timestamp codec', () => {
  it('brings a Timestamp back as a real Timestamp after JSON', () => {
    const original = Timestamp.fromDate(new Date('2026-11-12T10:20:30.000Z'));
    const result = roundTrip({createdAt: original}) as {createdAt: Timestamp};
    expect(result.createdAt).toBeInstanceOf(Timestamp);
    expect(result.createdAt.toDate().toISOString()).toBe(
      '2026-11-12T10:20:30.000Z',
    );
  });

  it('finds Timestamps inside arrays and nested objects', () => {
    const t = Timestamp.fromMillis(1_700_000_000_000);
    const result = roundTrip({
      list: [
        {createdAt: t, title: 'a'},
        {createdAt: t, title: 'b'},
      ],
      nested: {deep: {at: t}},
    }) as {
      list: Array<{createdAt: Timestamp; title: string}>;
      nested: {deep: {at: Timestamp}};
    };
    expect(result.list[1].createdAt.toMillis()).toBe(1_700_000_000_000);
    expect(result.nested.deep.at).toBeInstanceOf(Timestamp);
  });

  it('leaves everything else exactly as it was', () => {
    const plain = {
      id: 'x',
      amount: '12.50',
      amountMinor: 1250,
      tags: ['a', 'b'],
      note: null,
      done: false,
      nothing: undefined,
    };
    expect(roundTrip(plain)).toEqual({
      id: 'x',
      amount: '12.50',
      amountMinor: 1250,
      tags: ['a', 'b'],
      note: null,
      done: false,
    });
  });

  it('keeps the nanoseconds', () => {
    const t = new Timestamp(1_700_000_000, 123_000_000);
    const result = roundTrip(t) as Timestamp;
    expect(result.nanoseconds).toBe(123_000_000);
  });
});
