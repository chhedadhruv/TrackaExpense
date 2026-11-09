import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockCallable = jest.fn<(payload: any) => Promise<any>>();

jest.mock('@react-native-firebase/app', () => ({getApp: () => ({})}));
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => (payload: unknown) => mockCallable(payload),
}));

import {
  lookupUserByEmail,
  lookupUserByPhone,
  lookupUsersByEmail,
} from '../src/services/UserLookup';

const user = (n: number) => ({
  uid: `u${n}`,
  email: `${n}@x.com`,
  name: `User ${n}`,
  avatar: null,
});

describe('UserLookup', () => {
  beforeEach(() => {
    mockCallable.mockReset();
  });

  it('returns one entry per email, in order, with null for unknown accounts', async () => {
    mockCallable.mockResolvedValue({
      data: {emails: [user(1), null, user(3)], phones: []},
    });
    const result = await lookupUsersByEmail(['1@x.com', 'no@x.com', '3@x.com']);
    expect(result).toEqual([user(1), null, user(3)]);
    expect(mockCallable).toHaveBeenCalledWith({
      emails: ['1@x.com', 'no@x.com', '3@x.com'],
    });
  });

  it('splits long lists into requests of at most 30 and keeps the order', async () => {
    const emails = Array.from({length: 65}, (_, i) => `${i}@x.com`);
    mockCallable.mockImplementation(async payload => ({
      data: {
        emails: (payload.emails as string[]).map(e => ({
          uid: e,
          email: e,
          name: null,
          avatar: null,
        })),
        phones: [],
      },
    }));
    const result = await lookupUsersByEmail(emails);
    expect(mockCallable).toHaveBeenCalledTimes(3);
    expect(result.map(r => r?.uid)).toEqual(emails);
  });

  it('does not call the function for an empty list', async () => {
    expect(await lookupUsersByEmail([])).toEqual([]);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('single lookups return the user or null', async () => {
    mockCallable.mockResolvedValueOnce({data: {emails: [null], phones: []}});
    expect(await lookupUserByEmail('no@x.com')).toBeNull();
    mockCallable.mockResolvedValueOnce({
      data: {emails: [], phones: [user(2)]},
    });
    expect(await lookupUserByPhone('555')).toEqual(user(2));
    expect(mockCallable).toHaveBeenLastCalledWith({phones: ['555']});
  });

  it('lets a failed call reach the screen', async () => {
    mockCallable.mockRejectedValue(new Error('unavailable'));
    await expect(lookupUserByEmail('a@x.com')).rejects.toThrow('unavailable');
  });
});
