import {describe, expect, it} from '@jest/globals';
import {cachedFlags} from '../src/data/cachedFlags';

describe('cachedFlags', () => {
  it('is loading while there is no data and the listener has not answered', () => {
    expect(cachedFlags(false, false, 'loading')).toEqual({
      loading: true,
      error: false,
      live: false,
      failed: false,
    });
  });

  it('is loading while the saved cache is still being read back', () => {
    expect(cachedFlags(false, true, 'live').loading).toBe(true);
    expect(cachedFlags(false, true, 'error').error).toBe(false);
  });

  it('shows a saved copy at once, but it is not live yet', () => {
    expect(cachedFlags(true, false, 'loading')).toEqual({
      loading: false,
      error: false,
      live: false,
      failed: false,
    });
  });

  it('is live once the listener has answered', () => {
    expect(cachedFlags(true, false, 'live')).toEqual({
      loading: false,
      error: false,
      live: true,
      failed: false,
    });
  });

  it('keeps saved data on screen when the listener fails, but reports the failure', () => {
    // A screen that writes from what it shows must see `failed` and refuse to build on the copy.
    expect(cachedFlags(true, false, 'error')).toEqual({
      loading: false,
      error: false,
      live: false,
      failed: true,
    });
  });

  it('is an error only when the listener failed and there is nothing to show', () => {
    expect(cachedFlags(false, false, 'error')).toEqual({
      loading: false,
      error: true,
      live: false,
      failed: true,
    });
  });

  it('never calls saved data live', () => {
    for (const status of ['loading', 'error'] as const) {
      expect(cachedFlags(true, false, status).live).toBe(false);
    }
  });
});
