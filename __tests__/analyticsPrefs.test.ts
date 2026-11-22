import {describe, expect, it, jest} from '@jest/globals';

const mockStore = new Map<string, boolean>();

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getBoolean: (key: string) => mockStore.get(key),
    set: (key: string, value: boolean) => {
      mockStore.set(key, value);
    },
  }),
}));

import {
  isAnalyticsEnabled,
  saveAnalyticsEnabled,
} from '../src/services/AnalyticsPrefs';

describe('analytics preference', () => {
  it('is on by default and remembers a change', () => {
    expect(isAnalyticsEnabled()).toBe(true);
    saveAnalyticsEnabled(false);
    expect(isAnalyticsEnabled()).toBe(false);
    saveAnalyticsEnabled(true);
    expect(isAnalyticsEnabled()).toBe(true);
  });
});
