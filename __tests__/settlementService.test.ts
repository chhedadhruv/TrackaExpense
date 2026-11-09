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

import {
  deleteSettlement,
  recordSettlement,
} from '../src/services/SettlementService';

describe('SettlementService', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
  });

  it('records a settlement through the recordSettlement callable', async () => {
    mockCallable.mockResolvedValue({
      data: {settlementId: 'r1', splitId: 'r1', alreadyRecorded: false},
    });
    const args = {
      groupId: 'g1',
      fromEmail: 'a@x.com',
      toEmail: 'b@x.com',
      amount: '12.5',
      note: '',
      includeInTransactions: true,
      requestId: 'req-12345678',
    };
    const result = await recordSettlement(args);
    expect(mockHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'recordSettlement',
    );
    expect(mockCallable).toHaveBeenCalledWith(args);
    expect(result.splitId).toBe('r1');
  });

  it('deletes a settlement through the deleteSettlement callable', async () => {
    mockCallable.mockResolvedValue({
      data: {deleted: true, settlementRemoved: true},
    });
    const result = await deleteSettlement('g1', 's1');
    expect(mockHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'deleteSettlement',
    );
    expect(mockCallable).toHaveBeenCalledWith({groupId: 'g1', splitId: 's1'});
    expect(result).toEqual({deleted: true, settlementRemoved: true});
  });

  it('lets a failed call reach the screen', async () => {
    mockCallable.mockRejectedValue(new Error('unavailable'));
    await expect(deleteSettlement('g1', 's1')).rejects.toThrow('unavailable');
  });
});
