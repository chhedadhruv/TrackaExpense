import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  activeListenerCount,
  retainListener,
} from '../src/data/retainedListener';

// Let go of anything a failed test left running.
const releases: Array<() => void> = [];
const retain = (id: string, start: () => () => void) => {
  const release = retainListener(id, start);
  releases.push(release);
  return release;
};

describe('retainListener', () => {
  beforeEach(() => {
    while (releases.length) {
      releases.pop()?.();
    }
  });

  it('starts one listener for any number of users of the same id', () => {
    const stop = jest.fn();
    const start = jest.fn(() => stop);
    retain('groups', start);
    retain('groups', start);
    retain('groups', start);
    expect(start).toHaveBeenCalledTimes(1);
    expect(activeListenerCount()).toBe(1);
  });

  it('stops only when the last user lets go', () => {
    const stop = jest.fn();
    const first = retain('groups', () => stop);
    const second = retain('groups', () => stop);
    first();
    expect(stop).not.toHaveBeenCalled();
    second();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(activeListenerCount()).toBe(0);
  });

  it('keeps different ids apart', () => {
    const stopA = jest.fn();
    const stopB = jest.fn();
    const a = retain('groups', () => stopA);
    retain('invitations', () => stopB);
    a();
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).not.toHaveBeenCalled();
  });

  it('starts a fresh listener after everyone let go', () => {
    const start = jest.fn(() => jest.fn());
    const release = retain('groups', start);
    release();
    retain('groups', start);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('ignores letting go twice', () => {
    const stop = jest.fn();
    const first = retain('groups', () => stop);
    retain('groups', () => stop);
    first();
    first();
    expect(stop).not.toHaveBeenCalled();
    expect(activeListenerCount()).toBe(1);
  });
});
