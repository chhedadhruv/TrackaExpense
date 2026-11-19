import {describe, expect, it} from '@jest/globals';
import {isFunNudgeOn} from '../src/utils/notificationPrefs';

describe('isFunNudgeOn', () => {
  it('is off only for an explicit false', () => {
    expect(isFunNudgeOn(false)).toBe(false);
    expect(isFunNudgeOn(true)).toBe(true);
  });

  it('stays on for a profile that never had the field', () => {
    expect(isFunNudgeOn(undefined)).toBe(true);
    expect(isFunNudgeOn(null)).toBe(true);
  });
});
