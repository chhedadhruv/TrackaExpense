import {describe, expect, it} from '@jest/globals';
import {
  authMethodOf,
  buildAnalyticsProfile,
} from '../src/utils/analyticsProfile';

describe('authMethodOf', () => {
  it('maps Firebase provider ids to the login method names', () => {
    expect(authMethodOf(['google.com'])).toBe('google');
    expect(authMethodOf(['apple.com'])).toBe('apple');
    expect(authMethodOf(['password'])).toBe('email');
    expect(authMethodOf([])).toBe('unknown');
  });
});

describe('buildAnalyticsProfile', () => {
  it('builds setup facts only', () => {
    expect(
      buildAnalyticsProfile({
        currency: 'INR',
        savingsGoalCount: 2,
        appLockEnabled: true,
        theme: 'dark',
        providerIds: ['password'],
      }),
    ).toEqual({
      currency: 'INR',
      auth_method: 'email',
      has_savings_goals: true,
      savings_goal_count: 2,
      app_lock_enabled: true,
      theme: 'dark',
    });
  });

  it('reports no goals as false', () => {
    const profile = buildAnalyticsProfile({
      savingsGoalCount: 0,
      appLockEnabled: false,
      theme: 'system',
      providerIds: [],
    });
    expect(profile.has_savings_goals).toBe(false);
  });
});
