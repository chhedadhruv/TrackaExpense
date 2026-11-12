import {reportError} from '../src/services/ErrorReporter';
import * as RootNavigation from '../navigation/Routes';
import {TAB} from '../navigation/tabNames';

export interface NotificationData {
  type?: string;
  action?: string;
  groupId?: string;
  groupName?: string;
  splitId?: string;
  [key: string]: unknown;
}

/** Opens the screen that matches a tapped notification's data. */
export function handleNotificationNavigation(
  data: NotificationData | undefined,
): void {
  if (!data) {
    return;
  }
  try {
    switch (data.type) {
      case 'split_invite':
      case 'group_created':
        RootNavigation.navigate(TAB.split, {screen: 'Invitations'});
        break;
      case 'split_created':
      case 'split_updated':
      case 'split_deleted':
      case 'settlement_made':
        if (data.groupId) {
          RootNavigation.navigate(TAB.split, {
            screen: 'SplitGroupDetail',
            params: {
              group: {id: data.groupId, name: data.groupName || 'Split Group'},
            },
          });
        }
        break;
      case 'user_joined_group':
      case 'user_left_group':
      case 'group_updated':
        if (data.groupId) {
          RootNavigation.navigate(TAB.split, {
            screen: 'SplitGroupDetail',
            params: {
              group: {id: data.groupId, name: data.groupName || 'Split Group'},
            },
          });
        }
        break;
      case 'group_deleted':
        RootNavigation.navigate(TAB.split, {screen: 'Split'});
        break;
      case 'settlement_reminder':
        RootNavigation.navigate(TAB.split, {screen: 'FriendsBalance'});
        break;
      case 'reminder':
        if (data.action === 'add_income') {
          RootNavigation.navigate(TAB.home, {screen: 'AddIncome'});
        } else if (data.action === 'add_expense') {
          RootNavigation.navigate(TAB.home, {screen: 'AddExpense'});
        } else if (data.action === 'add_savings') {
          RootNavigation.navigate(TAB.savings, {screen: 'Savings'});
        } else {
          RootNavigation.navigate(TAB.home, {screen: 'Home'});
        }
        break;
      case 'achievement':
        RootNavigation.navigate(TAB.statistic, {screen: 'Statistic'});
        break;
      case 'weekly_summary':
      case 'monthly_goal':
        RootNavigation.navigate(TAB.statistic, {screen: 'Statistic'});
        break;
      default:
        RootNavigation.navigate(TAB.home, {screen: 'Home'});
        break;
    }
  } catch (error) {
    reportError(error as Error);
    console.error('Failed to handle notification navigation:', error);
  }
}
