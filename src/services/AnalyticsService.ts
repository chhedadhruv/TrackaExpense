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

// Aggregate facts about the person's setup only: no names, titles or exact amounts.
export const setUserProperties = (props: {
  currency?: string;
  auth_method?: string;
  has_splits?: boolean;
  has_savings_goals?: boolean;
  savings_goal_count?: number;
  app_lock_enabled?: boolean;
  theme?: string;
}): void => {
  const definedProps = Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean>;
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

export const logCreateGroup = (params: {
  category: string;
  invited_count: number;
}): void => {
  track('Group Created', params);
  setUserProperties({has_splits: true});
};

export const logInviteMember = (params: {
  invite_count: number;
  source: 'group_create' | 'resend';
}): void => {
  track('Group Member Invited', params);
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
  setUserProperties({has_splits: true});
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

// ─── Screen Events ────────────────────────────────────────────────────────────

export const logScreenViewed = (screen_name: string): void => {
  track('Screen Viewed', {screen_name});
};

// ─── Budget Events ────────────────────────────────────────────────────────────

export const logBudgetCreated = (params: {
  category: string;
  period: string;
}): void => {
  track('Budget Created', params);
};

export const logBudgetEdited = (params: {category: string}): void => {
  track('Budget Edited', params);
};

export const logBudgetDeleted = (): void => {
  track('Budget Deleted');
};

// ─── Recurring Events ─────────────────────────────────────────────────────────

export const logRecurringCreated = (params: {
  type: string;
  category: string;
  frequency: string;
}): void => {
  track('Recurring Created', params);
};

export const logRecurringEdited = (params: {type: string}): void => {
  track('Recurring Edited', params);
};

export const logRecurringDeleted = (params: {type: string}): void => {
  track('Recurring Deleted', params);
};

// ─── Credit Card Events ───────────────────────────────────────────────────────

export const logCardAdded = (): void => {
  track('Card Added');
};

export const logCardDeleted = (): void => {
  track('Card Deleted');
};

export const logCardBillPaid = (amount_range: string): void => {
  track('Card Bill Paid', {amount_range});
};

// ─── Capture and Export Events ────────────────────────────────────────────────

export const logReceiptScanned = (params: {
  success: boolean;
  fields_filled: number;
}): void => {
  track('Receipt Scanned', params);
};

export const logBankMessageParsed = (params: {
  recognized: boolean;
  target: string;
}): void => {
  track('Bank Message Parsed', params);
};

export const logDataExported = (format: string): void => {
  track('Data Exported', {format});
};

// ─── Onboarding and Settings Events ───────────────────────────────────────────

export const logOnboardingStarted = (): void => {
  track('Onboarding Started');
};

export const logOnboardingCompleted = (): void => {
  track('Onboarding Completed');
};

export const logOnboardingSkipped = (step: number): void => {
  track('Onboarding Skipped', {step});
};

export const logThemeChanged = (theme: string): void => {
  track('Theme Changed', {theme});
};

export const logAppLockToggled = (enabled: boolean): void => {
  track('App Lock Toggled', {enabled});
};

export const logNotificationPrefChanged = (params: {
  pref: string;
  enabled: boolean;
}): void => {
  track('Notification Pref Changed', params);
};

export const logCustomCategoryCreated = (type: string): void => {
  track('Custom Category Created', {type});
};

export const logTagAdded = (): void => {
  track('Tag Added');
};

// ─── IOU and Invite Link Events ───────────────────────────────────────────────

export const logIouCreated = (params: {
  direction: string;
  amount_range: string;
}): void => {
  track('IOU Created', params);
};

export const logIouSettled = (amount_range: string): void => {
  track('IOU Settled', {amount_range});
};

export const logInviteLinkJoined = (): void => {
  track('Invite Link Joined');
  setUserProperties({has_splits: true});
};
