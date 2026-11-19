import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockOpenPath = jest.fn<(path: string) => void>();
const mockReportError = jest.fn();

jest.mock('../src/navigation/openPath', () => ({
  openPath: (path: string) => mockOpenPath(path),
}));
jest.mock('../src/services/ErrorReporter', () => ({
  reportError: (error: unknown) => mockReportError(error),
}));

import {
  handleNotificationNavigation,
  notificationPath,
} from '../services/NotificationNavigation';

describe('notificationPath', () => {
  it('opens the invitations screen for an invite or a new group', () => {
    expect(notificationPath({type: 'split_invite'})).toBe('/split/invitations');
    expect(notificationPath({type: 'group_created'})).toBe(
      '/split/invitations',
    );
  });

  it('opens a group when a split notification names one', () => {
    expect(
      notificationPath({
        type: 'split_created',
        groupId: 'g1',
        groupName: 'Trip',
      }),
    ).toBe('/split/group/g1?groupName=Trip');
  });

  it('encodes a group id and name that contain special characters', () => {
    expect(
      notificationPath({
        type: 'settlement_made',
        groupId: 'a/b',
        groupName: 'Flat & Food 100%',
      }),
    ).toBe('/split/group/a%2Fb?groupName=Flat%20%26%20Food%20100%25');
  });

  it('falls back to a default group name', () => {
    expect(notificationPath({type: 'group_updated', groupId: 'g2'})).toBe(
      '/split/group/g2?groupName=Split%20Group',
    );
  });

  it('has no path for a group notification that names no group', () => {
    expect(notificationPath({type: 'split_deleted'})).toBeNull();
  });

  it('opens the groups list after a group was deleted', () => {
    expect(notificationPath({type: 'group_deleted'})).toBe('/split');
  });

  it('opens the friends balances for a settle-up reminder', () => {
    expect(notificationPath({type: 'settlement_reminder'})).toBe(
      '/split/friends',
    );
  });

  it('opens the add forms, savings or Home from a reminder', () => {
    expect(notificationPath({type: 'reminder', action: 'add_income'})).toBe(
      '/income/add',
    );
    expect(notificationPath({type: 'reminder', action: 'add_expense'})).toBe(
      '/expense/add',
    );
    expect(notificationPath({type: 'reminder', action: 'add_savings'})).toBe(
      '/savings',
    );
    expect(notificationPath({type: 'reminder', action: 'other'})).toBe('/home');
  });

  it('opens Statistic for achievements and summaries', () => {
    for (const type of [
      'achievement',
      'weekly_summary',
      'monthly_summary',
      'monthly_goal',
    ]) {
      expect(notificationPath({type})).toBe('/statistic');
    }
  });

  it('opens the card bill for a card reminder', () => {
    expect(notificationPath({type: 'card_due', cardId: 'c 1'})).toBe(
      '/profile/card-bill?id=c%201',
    );
    expect(notificationPath({type: 'card_due'})).toBe('/profile/cards');
  });

  it('opens Home for an unknown type', () => {
    expect(notificationPath({type: 'something_new'})).toBe('/home');
  });
});

describe('handleNotificationNavigation', () => {
  beforeEach(() => {
    mockOpenPath.mockReset();
    mockReportError.mockReset();
  });

  it('does nothing without data', () => {
    handleNotificationNavigation(undefined);
    expect(mockOpenPath).not.toHaveBeenCalled();
  });

  it('opens the path for the notification', () => {
    handleNotificationNavigation({type: 'split_invite'});
    expect(mockOpenPath).toHaveBeenCalledWith('/split/invitations');
  });

  it('does not open anything for a group notification without a group', () => {
    handleNotificationNavigation({type: 'split_deleted'});
    expect(mockOpenPath).not.toHaveBeenCalled();
  });

  it('reports an error instead of throwing when opening fails', () => {
    mockOpenPath.mockImplementation(() => {
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
