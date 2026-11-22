import {describe, expect, it, jest} from '@jest/globals';
import {settleWrite} from '../src/utils/offlineWrite';

describe('settleWrite', () => {
  it('waits for the write when online', async () => {
    let done = false;
    const write = new Promise<void>(resolve =>
      setTimeout(() => {
        done = true;
        resolve();
      }, 5),
    );
    const result = await settleWrite(write, true, jest.fn());
    expect(done).toBe(true);
    expect(result).toEqual({queued: false});
  });

  it('passes an error to the caller when online', async () => {
    await expect(
      settleWrite(Promise.reject(new Error('denied')), true, jest.fn()),
    ).rejects.toThrow('denied');
  });

  it('does not wait for a write that never resolves when offline', async () => {
    const never = new Promise<void>(() => {});
    const result = await settleWrite(never, false, jest.fn());
    expect(result).toEqual({queued: true});
  });

  it('reports a late failure of an offline write', async () => {
    const onLateError = jest.fn();
    const error = new Error('denied');
    const result = await settleWrite(Promise.reject(error), false, onLateError);
    expect(result).toEqual({queued: true});
    await Promise.resolve();
    expect(onLateError).toHaveBeenCalledWith(error);
  });
});
