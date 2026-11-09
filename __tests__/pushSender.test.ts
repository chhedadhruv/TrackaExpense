import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockCallable = jest.fn<(payload: any) => Promise<any>>();
const mockHttpsCallable = jest.fn((_functions: unknown, _name: string) => {
  return (payload: unknown) => mockCallable(payload);
});

jest.mock('@react-native-firebase/app', () => ({getApp: () => ({})}));
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (functions: unknown, name: string) =>
    mockHttpsCallable(functions, name),
}));

import {sendPush} from '../src/services/PushSender';

describe('PushSender', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
  });

  it('sends through the sendPush callable and returns its result', async () => {
    mockCallable.mockResolvedValue({
      data: {sent: true, stored: false, recipients: 2, skipped: 0},
    });
    const args = {
      emails: ['a@x.com', 'b@x.com'],
      type: 'split_created',
      title: 'New split',
      body: 'Dinner',
      data: {type: 'split_created', groupId: 'g1'},
      groupId: 'g1',
    };
    const result = await sendPush(args);
    expect(mockHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'sendPush',
    );
    expect(mockCallable).toHaveBeenCalledWith(args);
    expect(result).toEqual({
      sent: true,
      stored: false,
      recipients: 2,
      skipped: 0,
    });
  });

  it('lets a failed call reach the caller', async () => {
    mockCallable.mockRejectedValue(new Error('resource-exhausted'));
    await expect(
      sendPush({
        emails: ['a@x.com'],
        type: 't',
        title: 'T',
        body: 'B',
        data: {},
      }),
    ).rejects.toThrow('resource-exhausted');
  });
});
