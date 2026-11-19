import {describe, expect, it} from '@jest/globals';
import {isCardRemindersOn, isFunNudgeOn} from '../src/utils/notificationPrefs';

describe('isCardRemindersOn', () => {
  it('is off only for an explicit false', () => {
    expect(isCardRemindersOn(false)).toBe(false);
    expect(isCardRemindersOn(true)).toBe(true);
  });

  it('stays on for a profile that never had the field', () => {
    expect(isCardRemindersOn(undefined)).toBe(true);
    expect(isCardRemindersOn(null)).toBe(true);
  });
});

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
