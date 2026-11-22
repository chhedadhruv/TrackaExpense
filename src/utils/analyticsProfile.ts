/**
 * The people-profile facts sent to analytics. Only setup facts that are already in the cache:
 * never a name, email, title or amount.
 */
export interface AnalyticsProfileInput {
  currency?: string;
  savingsGoalCount: number;
  appLockEnabled: boolean;
  theme: string;
  /** Firebase provider ids of the signed-in account, for example ['google.com']. */
  providerIds: readonly string[];
}

export type AuthMethod = 'email' | 'google' | 'apple' | 'unknown';

/** Maps the Firebase provider id to the same method names the login events use. */
export const authMethodOf = (providerIds: readonly string[]): AuthMethod => {
  if (providerIds.includes('google.com')) {
    return 'google';
  }
  if (providerIds.includes('apple.com')) {
    return 'apple';
  }
  if (providerIds.includes('password')) {
    return 'email';
  }
  return 'unknown';
};

export const buildAnalyticsProfile = (input: AnalyticsProfileInput) => ({
  currency: input.currency,
  auth_method: authMethodOf(input.providerIds),
  has_savings_goals: input.savingsGoalCount > 0,
  savings_goal_count: input.savingsGoalCount,
  app_lock_enabled: input.appLockEnabled,
  theme: input.theme,
});
