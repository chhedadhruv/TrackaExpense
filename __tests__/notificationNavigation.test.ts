import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockNavigate = jest.fn<(name: string, params?: unknown) => void>();
const mockReportError = jest.fn();

jest.mock('../navigation/Routes', () => ({
  navigate: (name: string, params?: unknown) => mockNavigate(name, params),
}));
jest.mock('../src/services/ErrorReporter', () => ({
  reportError: (error: unknown) => mockReportError(error),
}));

import {handleNotificationNavigation} from '../services/NotificationNavigation';
import {TAB} from '../navigation/tabNames';

describe('tab names', () => {
  it('are distinct from the screens inside each tab', () => {
    // A tab named like the first screen of its own stack triggers React Navigation's "same name
    // nested inside one another" warning and makes navigate() ambiguous.
    const innerScreens = ['Home', 'Statistic', 'Split', 'Savings', 'Profile'];
    for (const tab of Object.values(TAB)) {
      expect(innerScreens).not.toContain(tab);
    }
  });

  it('are all different from each other', () => {
    const names = Object.values(TAB);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('handleNotificationNavigation', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockReportError.mockReset();
  });

  it('does nothing without data', () => {
    handleNotificationNavigation(undefined);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the invitations screen in the Split tab', () => {
    handleNotificationNavigation({type: 'split_invite'});
    expect(mockNavigate).toHaveBeenCalledWith(TAB.split, {
      screen: 'Invitations',
    });
  });

  it('opens a group when a split notification names one', () => {
    handleNotificationNavigation({
      type: 'split_created',
      groupId: 'g1',
      groupName: 'Trip',
    });
    expect(mockNavigate).toHaveBeenCalledWith(TAB.split, {
      screen: 'SplitGroupDetail',
      params: {group: {id: 'g1', name: 'Trip'}},
    });
  });

  it('falls back to a default group name', () => {
    handleNotificationNavigation({type: 'group_updated', groupId: 'g2'});
    expect(mockNavigate).toHaveBeenCalledWith(TAB.split, {
      screen: 'SplitGroupDetail',
      params: {group: {id: 'g2', name: 'Split Group'}},
    });
  });

  it('does not navigate to a group when none is named', () => {
    handleNotificationNavigation({type: 'split_deleted'});
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the groups list after a group was deleted', () => {
    handleNotificationNavigation({type: 'group_deleted'});
    expect(mockNavigate).toHaveBeenCalledWith(TAB.split, {screen: 'Split'});
  });

  it('opens the friends balances for a settle-up reminder', () => {
    handleNotificationNavigation({type: 'settlement_reminder'});
    expect(mockNavigate).toHaveBeenCalledWith(TAB.split, {
      screen: 'FriendsBalance',
    });
  });

  it('opens the add forms from a reminder, in the Home tab', () => {
    handleNotificationNavigation({type: 'reminder', action: 'add_income'});
    expect(mockNavigate).toHaveBeenLastCalledWith(TAB.home, {
      screen: 'AddIncome',
    });
    handleNotificationNavigation({type: 'reminder', action: 'add_expense'});
    expect(mockNavigate).toHaveBeenLastCalledWith(TAB.home, {
      screen: 'AddExpense',
    });
  });

  it('opens savings from a savings reminder and Home from any other reminder', () => {
    handleNotificationNavigation({type: 'reminder', action: 'add_savings'});
    expect(mockNavigate).toHaveBeenLastCalledWith(TAB.savings, {
      screen: 'Savings',
    });
    handleNotificationNavigation({type: 'reminder', action: 'other'});
    expect(mockNavigate).toHaveBeenLastCalledWith(TAB.home, {screen: 'Home'});
  });

  it('opens Statistic for achievements and summaries', () => {
    for (const type of ['achievement', 'weekly_summary', 'monthly_goal']) {
      mockNavigate.mockClear();
      handleNotificationNavigation({type});
      expect(mockNavigate).toHaveBeenCalledWith(TAB.statistic, {
        screen: 'Statistic',
      });
    }
  });

  it('opens Home for an unknown type', () => {
    handleNotificationNavigation({type: 'something_new'});
    expect(mockNavigate).toHaveBeenCalledWith(TAB.home, {screen: 'Home'});
  });

  it('reports an error instead of throwing when navigation fails', () => {
    mockNavigate.mockImplementation(() => {
      throw new Error('not ready');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      handleNotificationNavigation({type: 'something_new'}),
    ).not.toThrow();
    expect(mockReportError).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
