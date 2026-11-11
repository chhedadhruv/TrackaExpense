import {describe, expect, it} from '@jest/globals';
import {isServiceEnabled} from '../src/utils/serviceGate';

describe('isServiceEnabled', () => {
  it('starts in a release build when the key is set', () => {
    expect(isServiceEnabled('abc123', false)).toBe(true);
  });

  it('never starts in a development build, even with a key', () => {
    expect(isServiceEnabled('abc123', true)).toBe(false);
  });

  it('does not start without a key', () => {
    expect(isServiceEnabled(undefined, false)).toBe(false);
    expect(isServiceEnabled(null, false)).toBe(false);
    expect(isServiceEnabled('', false)).toBe(false);
    expect(isServiceEnabled('   ', false)).toBe(false);
  });

  it('does not start in dev without a key either', () => {
    expect(isServiceEnabled('', true)).toBe(false);
  });
});
