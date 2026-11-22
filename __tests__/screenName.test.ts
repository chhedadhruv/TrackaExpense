import {describe, expect, it} from '@jest/globals';
import {screenNameFromSegments} from '../src/utils/screenName';

describe('screenNameFromSegments', () => {
  it('returns null while there is nothing to report', () => {
    expect(screenNameFromSegments([])).toBeNull();
    expect(screenNameFromSegments(['(app)'])).toBeNull();
  });

  it('drops the app and auth groups and keeps the tab folder', () => {
    expect(screenNameFromSegments(['(app)', '(split)', 'index'])).toBe(
      'split/index',
    );
    expect(screenNameFromSegments(['(auth)', 'login'])).toBe('login');
  });

  it('keeps dynamic segments as placeholders so ids never leave the phone', () => {
    expect(
      screenNameFromSegments(['(app)', '(split)', 'group', '[groupId]']),
    ).toBe('split/group/[groupId]');
  });
});
