import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockTrack = jest.fn();
const mockSetUserProperties = jest.fn();

jest.mock('../src/services/MixpanelService', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

import * as AnalyticsService from '../src/services/AnalyticsService';

// Property names that must never appear on an event: they would carry personal data.
const FORBIDDEN_KEYS = [
  'email',
  'name',
  'title',
  'description',
  'amount',
  'group_id',
  'uid',
];

const lastEvent = () => {
  const calls = mockTrack.mock.calls;
  return calls[calls.length - 1] as [string, Record<string, unknown>?];
};

describe('AnalyticsService', () => {
  beforeEach(() => {
    mockTrack.mockClear();
    mockSetUserProperties.mockClear();
  });

  it('buckets amounts into ranges', () => {
    expect(AnalyticsService.getAmountRange(50)).toBe('0-100');
    expect(AnalyticsService.getAmountRange(100)).toBe('100-500');
    expect(AnalyticsService.getAmountRange(500)).toBe('500+');
  });

  it('sends the approved event names', () => {
    AnalyticsService.logScreenViewed('split/group/[groupId]');
    expect(lastEvent()).toEqual([
      'Screen Viewed',
      {screen_name: 'split/group/[groupId]'},
    ]);

    AnalyticsService.logBudgetCreated({category: 'Food', period: 'monthly'});
    expect(lastEvent()[0]).toBe('Budget Created');

    AnalyticsService.logCardBillPaid('500+');
    expect(lastEvent()).toEqual(['Card Bill Paid', {amount_range: '500+'}]);

    AnalyticsService.logBankMessageParsed({
      recognized: true,
      target: 'expense',
    });
    expect(lastEvent()[0]).toBe('Bank Message Parsed');

    AnalyticsService.logInviteLinkJoined();
    expect(lastEvent()[0]).toBe('Invite Link Joined');
  });

  it('reports group and invite counts instead of ids', () => {
    AnalyticsService.logCreateGroup({category: 'Trip', invited_count: 3});
    expect(lastEvent()).toEqual([
      'Group Created',
      {category: 'Trip', invited_count: 3},
    ]);
    AnalyticsService.logInviteMember({invite_count: 2, source: 'group_create'});
    expect(lastEvent()).toEqual([
      'Group Member Invited',
      {invite_count: 2, source: 'group_create'},
    ]);
  });

  it('marks the person as a splits user when they join or create a group', () => {
    AnalyticsService.logCreateGroup({category: 'Trip', invited_count: 0});
    expect(mockSetUserProperties).toHaveBeenLastCalledWith({has_splits: true});
    mockSetUserProperties.mockClear();
    AnalyticsService.logAcceptInvitation();
    expect(mockSetUserProperties).toHaveBeenCalledWith({has_splits: true});
    mockSetUserProperties.mockClear();
    AnalyticsService.logInviteLinkJoined();
    expect(mockSetUserProperties).toHaveBeenCalledWith({has_splits: true});
  });

  it('never puts personal fields on any new event', () => {
    AnalyticsService.logBudgetCreated({category: 'Food', period: 'monthly'});
    AnalyticsService.logRecurringCreated({
      type: 'expense',
      category: 'Rent',
      frequency: 'monthly',
    });
    AnalyticsService.logReceiptScanned({success: true, fields_filled: 2});
    AnalyticsService.logIouCreated({direction: 'iowe', amount_range: '0-100'});
    AnalyticsService.logNotificationPrefChanged({
      pref: 'evening_reminder',
      enabled: true,
    });
    AnalyticsService.logSavingsGoalCompleted({
      category: 'travel',
      time_to_complete_days: 30,
    });
    for (const [, props] of mockTrack.mock.calls as Array<
      [string, Record<string, unknown>?]
    >) {
      for (const key of Object.keys(props ?? {})) {
        expect(FORBIDDEN_KEYS).not.toContain(key);
      }
    }
  });

  it('drops undefined user properties and sends nothing when none are set', () => {
    AnalyticsService.setUserProperties({currency: undefined});
    expect(mockSetUserProperties).not.toHaveBeenCalled();
    AnalyticsService.setUserProperties({currency: 'INR', theme: undefined});
    expect(mockSetUserProperties).toHaveBeenCalledWith({currency: 'INR'});
  });
});
