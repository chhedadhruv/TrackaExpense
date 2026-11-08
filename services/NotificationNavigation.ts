import {reportError} from '../src/services/ErrorReporter';
import * as RootNavigation from '../navigation/Routes';

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
        RootNavigation.navigate('Split', {screen: 'Invitations'});
        break;
      case 'split_created':
      case 'split_updated':
      case 'split_deleted':
      case 'settlement_made':
        if (data.groupId) {
          RootNavigation.navigate('Split', {
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
          RootNavigation.navigate('Split', {
            screen: 'SplitGroupDetail',
            params: {
              group: {id: data.groupId, name: data.groupName || 'Split Group'},
            },
          });
        }
        break;
      case 'group_deleted':
        RootNavigation.navigate('Split', {screen: 'Split'});
        break;
      case 'settlement_reminder':
        RootNavigation.navigate('Split', {screen: 'FriendsBalance'});
        break;
      case 'reminder':
        if (data.action === 'add_income') {
          RootNavigation.navigate('Home', {screen: 'AddIncome'});
        } else if (data.action === 'add_expense') {
          RootNavigation.navigate('Home', {screen: 'AddExpense'});
        } else if (data.action === 'add_savings') {
          RootNavigation.navigate('Savings', {screen: 'Savings'});
        } else {
          RootNavigation.navigate('Home', {screen: 'Home'});
        }
        break;
      case 'achievement':
        RootNavigation.navigate('Statistic', {screen: 'Statistic'});
        break;
      case 'weekly_summary':
      case 'monthly_goal':
        RootNavigation.navigate('Statistic', {screen: 'Statistic'});
        break;
      default:
        RootNavigation.navigate('Home', {screen: 'Home'});
        break;
    }
  } catch (error) {
    reportError(error as Error);
    console.error('Failed to handle notification navigation:', error);
  }
}
