import {describe, expect, it, jest} from '@jest/globals';
import {createActionGuard, runGuarded} from '../src/utils/actionGuard';

const deferred = () => {
  let resolve!: (v: string) => void;
  const promise = new Promise<string>(res => {
    resolve = res;
  });
  return {promise, resolve};
};

describe('runGuarded', () => {
  it('runs the action once for two synchronous calls', async () => {
    const guard = createActionGuard();
    const d = deferred();
    const action = jest.fn(() => d.promise);
    const onStart = jest.fn();
    const onEnd = jest.fn();

    const first = runGuarded(guard, action, onStart, onEnd);
    const second = runGuarded(guard, action, onStart, onEnd);

    expect(action).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(guard.isBusy()).toBe(true);

    d.resolve('done');
    expect(await first).toBe('done');
    expect(await second).toBeUndefined();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(guard.isBusy()).toBe(false);
  });

  it('releases the lock after an error and rethrows it', async () => {
    const guard = createActionGuard();
    const onEnd = jest.fn();
    await expect(
      runGuarded(
        guard,
        async () => {
          throw new Error('boom');
        },
        jest.fn(),
        onEnd,
      ),
    ).rejects.toThrow('boom');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(guard.isBusy()).toBe(false);

    const again = await runGuarded(
      guard,
      async () => 'ok',
      jest.fn(),
      jest.fn(),
    );
    expect(again).toBe('ok');
  });

  it('lets a later call run once the first has finished', async () => {
    const guard = createActionGuard();
    const action = jest.fn(async () => 'x');
    await runGuarded(guard, action, jest.fn(), jest.fn());
    await runGuarded(guard, action, jest.fn(), jest.fn());
    expect(action).toHaveBeenCalledTimes(2);
  });
});
