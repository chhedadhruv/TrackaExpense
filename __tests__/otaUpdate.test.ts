import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  applyUpdateWithin,
  shouldOfferRestart,
  SPLASH_UPDATE_TIMEOUT_MS,
  type UpdateApi,
} from '../src/utils/otaUpdate';

const never = <T>(): Promise<T> => new Promise<T>(() => {});

const makeApi = (overrides: Partial<UpdateApi> = {}) => {
  const reload = jest.fn(async () => {});
  const api: UpdateApi = {
    isEnabled: true,
    check: async () => true,
    fetch: async () => true,
    reload,
    ...overrides,
  };
  return {api, reload: (overrides.reload as typeof reload) ?? reload};
};

describe('applyUpdateWithin', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits five seconds by default', () => {
    expect(SPLASH_UPDATE_TIMEOUT_MS).toBe(5000);
  });

  it('asks nothing when updates are off', async () => {
    const check = jest.fn(async () => true);
    const {api, reload} = makeApi({isEnabled: false, check});
    await expect(applyUpdateWithin(api)).resolves.toBe('disabled');
    expect(check).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not download or restart when nothing is newer', async () => {
    const fetch = jest.fn(async () => true);
    const {api, reload} = makeApi({check: async () => false, fetch});
    await expect(applyUpdateWithin(api)).resolves.toBe('none');
    expect(fetch).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not restart when the download brings nothing new', async () => {
    const {api, reload} = makeApi({fetch: async () => false});
    await expect(applyUpdateWithin(api)).resolves.toBe('none');
    expect(reload).not.toHaveBeenCalled();
  });

  it('restarts into an update that arrives in time', async () => {
    const {api, reload} = makeApi();
    await expect(applyUpdateWithin(api)).resolves.toBe('applied');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('gives up after the timeout when the check hangs', async () => {
    const {api, reload} = makeApi({check: () => never<boolean>()});
    const result = applyUpdateWithin(api, 5000);
    jest.advanceTimersByTime(4999);
    let settled = false;
    result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(result).resolves.toBe('timeout');
    expect(reload).not.toHaveBeenCalled();
  });

  it('never restarts when the download finishes after the timeout', async () => {
    let finishDownload: (isNew: boolean) => void = () => {};
    const {api, reload} = makeApi({
      fetch: () =>
        new Promise<boolean>(resolve => {
          finishDownload = resolve;
        }),
    });
    const result = applyUpdateWithin(api, 5000);
    // Let the check resolve so the download has started.
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(5000);
    await expect(result).resolves.toBe('timeout');

    finishDownload(true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    ['check', {check: async () => Promise.reject(new Error('offline'))}],
    ['download', {fetch: async () => Promise.reject(new Error('offline'))}],
    ['restart', {reload: async () => Promise.reject(new Error('no'))}],
  ] as [string, Partial<UpdateApi>][])(
    'reports a failed %s without rejecting',
    async (_step, overrides) => {
      const {api} = makeApi(overrides);
      await expect(applyUpdateWithin(api)).resolves.toBe('failed');
    },
  );
});

describe('shouldOfferRestart', () => {
  it('stays hidden while no update is downloaded', () => {
    expect(
      shouldOfferRestart({
        isUpdatePending: false,
        downloadedUpdateId: 'u1',
        dismissedUpdateId: null,
      }),
    ).toBe(false);
  });

  it('shows for a downloaded update', () => {
    expect(
      shouldOfferRestart({
        isUpdatePending: true,
        downloadedUpdateId: 'u1',
        dismissedUpdateId: null,
      }),
    ).toBe(true);
  });

  it('stays hidden after Later for the same update', () => {
    expect(
      shouldOfferRestart({
        isUpdatePending: true,
        downloadedUpdateId: 'u1',
        dismissedUpdateId: 'u1',
      }),
    ).toBe(false);
  });

  it('shows again for a newer update than the one dismissed', () => {
    expect(
      shouldOfferRestart({
        isUpdatePending: true,
        downloadedUpdateId: 'u2',
        dismissedUpdateId: 'u1',
      }),
    ).toBe(true);
  });

  it('treats an update without an id as one update', () => {
    const args = {isUpdatePending: true, downloadedUpdateId: undefined};
    expect(shouldOfferRestart({...args, dismissedUpdateId: null})).toBe(true);
    expect(shouldOfferRestart({...args, dismissedUpdateId: ''})).toBe(false);
  });
});
