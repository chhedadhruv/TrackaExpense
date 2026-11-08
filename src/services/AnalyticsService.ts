import analytics from '@react-native-firebase/analytics';
import {
  setUserProperties as setMixpanelUserProperties,
  track,
} from './MixpanelService';

// Events go to Firebase Analytics (kept for this release) and to Mixpanel (approved event names).
// Error events are not sent to Mixpanel; errors go to Sentry through ErrorReporter.

const safe = (fn: () => Promise<void>): void => {
  fn().catch(() => {});
};

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
  safe(async () => {
    const a = analytics();
    if (props.currency !== undefined) {
      await a.setUserProperty('currency', props.currency);
    }
    if (props.auth_method !== undefined) {
      await a.setUserProperty('auth_method', props.auth_method);
    }
    if (props.transaction_count !== undefined) {
      await a.setUserProperty('transaction_count', props.transaction_count);
    }
    if (props.has_splits !== undefined) {
      await a.setUserProperty('has_splits', props.has_splits);
    }
    if (props.has_savings_goals !== undefined) {
      await a.setUserProperty('has_savings_goals', props.has_savings_goals);
    }
  });
  const definedProps = Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
  if (Object.keys(definedProps).length > 0) {
    setMixpanelUserProperties(definedProps);
  }
};

// ─── Auth Events ─────────────────────────────────────────────────────────────

export const logLogin = (method: 'email' | 'google' | 'apple'): void => {
  safe(() => analytics().logLogin({method}));
  track('User Logged In', {method});
};

export const logSignUp = (
  method: 'email' | 'google' | 'apple',
  currency_selected: string,
): void => {
  safe(() => analytics().logEvent('sign_up', {method, currency_selected}));
  track('User Signed Up', {method, currency_selected});
};

export const logPasswordResetRequested = (): void => {
  safe(() => analytics().logEvent('password_reset_requested', {}));
  track('Password Reset Requested');
};

// ─── Transaction Events ───────────────────────────────────────────────────────

export const logAddExpense = (params: {
  amount_range: string;
  category: string;
  has_image: boolean;
  has_description: boolean;
}): void => {
  safe(() =>
    analytics().logEvent('add_expense', {
      ...params,
      has_image: String(params.has_image),
      has_description: String(params.has_description),
    }),
  );
  track('Expense Added', params);
};

export const logAddIncome = (params: {
  amount_range: string;
  category: string;
}): void => {
  safe(() => analytics().logEvent('add_income', params));
  track('Income Added', params);
};

export const logEditTransaction = (params: {
  type: string;
  category: string;
  amount_changed: boolean;
}): void => {
  safe(() =>
    analytics().logEvent('edit_transaction', {
      ...params,
      amount_changed: String(params.amount_changed),
    }),
  );
  track('Transaction Edited', params);
};

export const logDeleteTransaction = (params: {
  type: string;
  category: string;
}): void => {
  safe(() => analytics().logEvent('delete_transaction', params));
  track('Transaction Deleted', params);
};

export const logTransactionSearch = (query_length: number): void => {
  safe(() => analytics().logEvent('transaction_search', {query_length}));
  track('Transactions Searched', {query_length});
};

export const logTransactionFilterChanged = (filter_type: string): void => {
  safe(() => analytics().logEvent('transaction_filter_changed', {filter_type}));
  track('Transaction Filter Changed', {filter_type});
};

// ─── Statistics Events ────────────────────────────────────────────────────────

export const logViewStatistics = (params: {
  chart_type: string;
  time_range: string;
}): void => {
  safe(() => analytics().logEvent('view_statistics', params));
  track('Statistics Viewed', params);
};

export const logStatisticsTimeRangeChanged = (range: string): void => {
  safe(() => analytics().logEvent('statistics_time_range_changed', {range}));
  track('Statistics Range Changed', {range});
};

// ─── Split Events ─────────────────────────────────────────────────────────────

export const logCreateGroup = (category: string): void => {
  safe(() => analytics().logEvent('create_group', {category}));
  track('Group Created', {category});
};

export const logInviteMember = (group_id: string): void => {
  safe(() => analytics().logEvent('invite_member', {group_id}));
  track('Group Member Invited', {group_id});
};

export const logCreateSplit = (params: {
  split_type: string;
  is_recurring: boolean;
  category: string;
  member_count: number;
}): void => {
  safe(() =>
    analytics().logEvent('create_split', {
      ...params,
      is_recurring: String(params.is_recurring),
      member_count: String(params.member_count),
    }),
  );
  track('Split Created', params);
};

export const logSettleUp = (amount_range: string): void => {
  safe(() => analytics().logEvent('settle_up', {amount_range}));
  track('Split Settled', {amount_range});
};

export const logAcceptInvitation = (): void => {
  safe(() => analytics().logEvent('accept_invitation', {}));
  track('Invitation Accepted');
};

export const logDeclineInvitation = (): void => {
  safe(() => analytics().logEvent('decline_invitation', {}));
  track('Invitation Declined');
};

// ─── Savings Events ───────────────────────────────────────────────────────────

export const logCreateSavingsGoal = (params: {
  category: string;
  has_target_date: boolean;
  has_monthly_target: boolean;
}): void => {
  safe(() =>
    analytics().logEvent('create_savings_goal', {
      ...params,
      has_target_date: String(params.has_target_date),
      has_monthly_target: String(params.has_monthly_target),
    }),
  );
  track('Savings Goal Created', params);
};

export const logAddFundsToGoal = (params: {
  amount_range: string;
  goal_category: string;
}): void => {
  safe(() => analytics().logEvent('add_funds_to_goal', params));
  track('Savings Goal Funded', params);
};

export const logWithdrawFromGoal = (params: {amount_range: string}): void => {
  safe(() => analytics().logEvent('withdraw_from_goal', params));
  track('Savings Goal Withdrawn', params);
};

export const logDeleteSavingsGoal = (): void => {
  safe(() => analytics().logEvent('delete_savings_goal', {}));
  track('Savings Goal Deleted');
};

export const logSavingsGoalCompleted = (params: {
  category: string;
  time_to_complete_days: number;
}): void => {
  safe(() =>
    analytics().logEvent('savings_goal_completed', {
      ...params,
      time_to_complete_days: String(params.time_to_complete_days),
    }),
  );
  track('Savings Goal Completed', params);
};

// ─── Error Event ──────────────────────────────────────────────────────────────

export const logError = (params: {
  error_type: string;
  screen_name: string;
  error_message: string;
}): void => safe(() => analytics().logEvent('error_occurred', params));
