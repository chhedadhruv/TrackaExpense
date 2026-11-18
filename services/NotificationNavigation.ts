import {reportError} from '../src/services/ErrorReporter';
import {openPath} from '../src/navigation/openPath';

export interface NotificationData {
  type?: string;
  action?: string;
  groupId?: string;
  groupName?: string;
  splitId?: string;
  [key: string]: unknown;
}

const groupPath = (groupId: string, groupName?: string): string =>
  `/split/group/${encodeURIComponent(groupId)}?groupName=${encodeURIComponent(
    groupName || 'Split Group',
  )}`;

/**
 * The app path a tapped notification should open. Anything unknown opens Home; a group
 * notification that names no group opens nothing (null).
 */
export function notificationPath(data: NotificationData): string | null {
  switch (data.type) {
    case 'split_invite':
    case 'group_created':
      return '/split/invitations';
    case 'split_created':
    case 'split_updated':
    case 'split_deleted':
    case 'settlement_made':
    case 'user_joined_group':
    case 'user_left_group':
    case 'group_updated':
      return data.groupId ? groupPath(data.groupId, data.groupName) : null;
    case 'group_deleted':
      return '/split';
    case 'settlement_reminder':
      return '/split/friends';
    case 'reminder':
      if (data.action === 'add_income') {
        return '/income/add';
      }
      if (data.action === 'add_expense') {
        return '/expense/add';
      }
      if (data.action === 'add_savings') {
        return '/savings';
      }
      return '/home';
    case 'achievement':
    case 'weekly_summary':
    case 'monthly_summary':
    case 'monthly_goal':
      return '/statistic';
    default:
      return '/home';
  }
}

/** Opens the screen that matches a tapped notification's data. */
export function handleNotificationNavigation(
  data: NotificationData | undefined,
): void {
  if (!data) {
    return;
  }
  try {
    const path = notificationPath(data);
    if (path !== null) {
      openPath(path);
    }
  } catch (error) {
    reportError(error as Error);
    console.error('Failed to handle notification navigation:', error);
  }
}
