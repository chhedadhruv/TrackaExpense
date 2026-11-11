import {
  setUserProperties as setMixpanelUserProperties,
  track,
} from './MixpanelService';

// Product analytics go to Mixpanel only (approved event names). Errors go to Sentry through
// ErrorReporter, never through here. Firebase Analytics was removed.
// In a development build Mixpanel does not start, so every call here is a no-op.

// ─── Utility ────────────────────────────────────────────────────────────────

export const getAmountRange = (amount: number): string => {
  if (amount < 100) {
    return '0-100';
  }
  if (amount < 500) {
    return '100-500';
  }
  return '500+';
};

// ─── User Properties ─────────────────────────────────────────────────────────

export const setUserProperties = (props: {
  currency?: string;
  auth_method?: string;
  transaction_count?: string;
  has_splits?: string;
  has_savings_goals?: string;
}): void => {
  const definedProps = Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
  if (Object.keys(definedProps).length > 0) {
    setMixpanelUserProperties(definedProps);
  }
};

// ─── Auth Events ─────────────────────────────────────────────────────────────

export const logLogin = (method: 'email' | 'google' | 'apple'): void => {
  track('User Logged In', {method});
};

export const logSignUp = (
  method: 'email' | 'google' | 'apple',
  currency_selected: string,
): void => {
  track('User Signed Up', {method, currency_selected});
};

export const logPasswordResetRequested = (): void => {
  track('Password Reset Requested');
};

// ─── Transaction Events ───────────────────────────────────────────────────────

export const logAddExpense = (params: {
  amount_range: string;
  category: string;
  has_image: boolean;
  has_description: boolean;
}): void => {
  track('Expense Added', params);
};

export const logAddIncome = (params: {
  amount_range: string;
  category: string;
}): void => {
  track('Income Added', params);
};

export const logEditTransaction = (params: {
  type: string;
  category: string;
  amount_changed: boolean;
}): void => {
  track('Transaction Edited', params);
};

export const logDeleteTransaction = (params: {
  type: string;
  category: string;
}): void => {
  track('Transaction Deleted', params);
};

export const logTransactionSearch = (query_length: number): void => {
  track('Transactions Searched', {query_length});
};

export const logTransactionFilterChanged = (filter_type: string): void => {
  track('Transaction Filter Changed', {filter_type});
};

// ─── Statistics Events ────────────────────────────────────────────────────────

export const logViewStatistics = (params: {
  chart_type: string;
  time_range: string;
}): void => {
  track('Statistics Viewed', params);
};

export const logStatisticsTimeRangeChanged = (range: string): void => {
  track('Statistics Range Changed', {range});
};

// ─── Split Events ─────────────────────────────────────────────────────────────

export const logCreateGroup = (category: string): void => {
  track('Group Created', {category});
};

export const logInviteMember = (group_id: string): void => {
  track('Group Member Invited', {group_id});
};

export const logCreateSplit = (params: {
  split_type: string;
  is_recurring: boolean;
  category: string;
  member_count: number;
}): void => {
  track('Split Created', params);
};

export const logSettleUp = (amount_range: string): void => {
  track('Split Settled', {amount_range});
};

export const logAcceptInvitation = (): void => {
  track('Invitation Accepted');
};

export const logDeclineInvitation = (): void => {
  track('Invitation Declined');
};

// ─── Savings Events ───────────────────────────────────────────────────────────

export const logCreateSavingsGoal = (params: {
  category: string;
  has_target_date: boolean;
  has_monthly_target: boolean;
}): void => {
  track('Savings Goal Created', params);
};

export const logAddFundsToGoal = (params: {
  amount_range: string;
  goal_category: string;
}): void => {
  track('Savings Goal Funded', params);
};

export const logWithdrawFromGoal = (params: {amount_range: string}): void => {
  track('Savings Goal Withdrawn', params);
};

export const logDeleteSavingsGoal = (): void => {
  track('Savings Goal Deleted');
};

export const logSavingsGoalCompleted = (params: {
  category: string;
  time_to_complete_days: number;
}): void => {
  track('Savings Goal Completed', params);
};
