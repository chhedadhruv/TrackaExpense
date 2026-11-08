import {describe, it, expect} from '@jest/globals';
import {compareVersions, isVersionBelow} from '../src/utils/version';

describe('compareVersions', () => {
  it('orders versions numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.3.5', '1.3.10')).toBeLessThan(0);
  });

  it('treats equal versions as equal, including missing parts', () => {
    expect(compareVersions('1.3.5', '1.3.5')).toBe(0);
    expect(compareVersions('1.3', '1.3.0')).toBe(0);
  });

  it('ignores non-numeric suffixes', () => {
    expect(compareVersions('1.3.5-beta', '1.3.5')).toBe(0);
  });
});

describe('isVersionBelow', () => {
  it('is true only when the installed version is older than the minimum', () => {
    expect(isVersionBelow('1.3.5', '1.4.0')).toBe(true);
    expect(isVersionBelow('1.4.0', '1.4.0')).toBe(false);
    expect(isVersionBelow('1.5.0', '1.4.0')).toBe(false);
  });

  it('never blocks when no minimum is set', () => {
    expect(isVersionBelow('0.0.1', '')).toBe(false);
    expect(isVersionBelow('0.0.1', '   ')).toBe(false);
    expect(isVersionBelow('1.3.5', '0.0.0')).toBe(false);
  });
});
