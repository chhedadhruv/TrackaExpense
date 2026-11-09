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

import {respondToInvitation} from '../src/services/InvitationService';

describe('InvitationService', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
  });

  it('accepts and declines through the respondToInvitation callable', async () => {
    mockCallable.mockResolvedValue({
      data: {status: 'accepted', alreadyDone: false},
    });
    expect(await respondToInvitation('inv1', true)).toEqual({
      status: 'accepted',
      alreadyDone: false,
    });
    expect(mockHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'respondToInvitation',
    );
    expect(mockCallable).toHaveBeenLastCalledWith({
      invitationId: 'inv1',
      accept: true,
    });
    await respondToInvitation('inv2', false);
    expect(mockCallable).toHaveBeenLastCalledWith({
      invitationId: 'inv2',
      accept: false,
    });
  });

  it('lets a failed call reach the screen', async () => {
    mockCallable.mockRejectedValue(new Error('permission-denied'));
    await expect(respondToInvitation('inv1', true)).rejects.toThrow(
      'permission-denied',
    );
  });
});
