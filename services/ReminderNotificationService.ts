import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NotificationService from './NotificationService';
import {getConfig} from '../src/services/RemoteConfigService';
import moment from 'moment';

type ReminderType = 'income' | 'expense' | 'savings' | 'general';

interface UserActivity {
  hasIncome: boolean;
  hasExpense: boolean;
  hasSavings: boolean;
  incomeCount?: number;
  expenseCount?: number;
  savingsCount?: number;
}

interface WeeklyActivity {
  incomeCount: number;
  expenseCount: number;
  savingsCount: number;
}

interface SavingsGoalRef {
  id: string;
  name: string;
  target: number;
  current: number;
  reminderFrequency?: 'weekly' | 'monthly';
}

class ReminderNotificationService {
  private notificationService: typeof NotificationService;
  private reminderMessages: Record<ReminderType, string[]>;

  constructor() {
    this.notificationService = NotificationService;
    this.reminderMessages = {
      income: [
        '💰 Time to log today\'s income! Your future self will thank you.',
        '💵 Don\'t forget to add your income for today. Every rupee counts!',
        '📈 Track your earnings today - it\'s the first step to financial freedom!',
        '💎 Your income deserves to be recorded. Add it now!',
        '🌟 Today\'s income is waiting to be logged. Don\'t keep it waiting!',
      ],
      expense: [
        '💸 Time to log today\'s expenses! Stay on top of your spending.',
        '🛒 Don\'t forget to add your expenses for today. Knowledge is power!',
        '📊 Track your spending today - awareness leads to better decisions!',
        '💳 Every expense tells a story. What\'s yours today?',
        '🎯 Log your expenses now and stay in control of your finances!',
      ],
      savings: [
        '🏦 Time to add your savings! Building wealth one day at a time.',
        '💰 Don\'t forget to log your savings for today. Small steps, big dreams!',
        '📈 Every rupee saved is a step closer to your goals!',
        '💎 Your savings deserve recognition. Add them now!',
        '🌟 Today\'s savings are tomorrow\'s opportunities!',
      ],
      general: [
        '📱 Hey! Don\'t forget to update your financial records today.',
        '💡 Quick reminder: Log your financial activities for today.',
        '🎯 Stay on track with your financial goals. Update your records now!',
        '📊 Your financial journey continues. Add today\'s activities!',
        '💪 Consistency is key! Update your financial records today.',
      ],
    };
  }

  async sendDailyReminders(): Promise<void> {
    if (!getConfig().enable_reminder_notifications) return;
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const userEmail = currentUser.email!;
      const today = moment().format('YYYY-MM-DD');

      const reminderCheck = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(today)
        .get();
      if (reminderCheck.exists) return;

      const userActivity = await this.getUserActivityForToday(currentUser.uid, today);
      const remindersToSend = this.determineRemindersToSend(userActivity);

      if (remindersToSend.length === 0) {
        await this.sendPositiveReminder(userEmail);
      } else {
        for (const reminderType of remindersToSend) {
          await this.sendSpecificReminder(userEmail, reminderType);
        }
      }
      await this.logReminderSent(currentUser.uid, today, remindersToSend);
    } catch (error) {
      console.error('Failed to send daily reminders:', error);
    }
  }

  async getUserActivityForToday(userId: string, date: string): Promise<UserActivity> {
    try {
      const startOfDay = moment(date).startOf('day').toDate();
      const endOfDay = moment(date).endOf('day').toDate();
      const [incomeSnapshot, expenseSnapshot, savingsSnapshot] = await Promise.all([
        firestore().collection('users').doc(userId).collection('income')
          .where('date', '>=', startOfDay).where('date', '<=', endOfDay).get(),
        firestore().collection('users').doc(userId).collection('expenses')
          .where('date', '>=', startOfDay).where('date', '<=', endOfDay).get(),
        firestore().collection('users').doc(userId).collection('savings')
          .where('date', '>=', startOfDay).where('date', '<=', endOfDay).get(),
      ]);
      return {
        hasIncome: !incomeSnapshot.empty,
        hasExpense: !expenseSnapshot.empty,
        hasSavings: !savingsSnapshot.empty,
        incomeCount: incomeSnapshot.size,
        expenseCount: expenseSnapshot.size,
        savingsCount: savingsSnapshot.size,
      };
    } catch (error) {
      console.error('Failed to get user activity:', error);
      return {hasIncome: false, hasExpense: false, hasSavings: false};
    }
  }

  determineRemindersToSend(userActivity: UserActivity): ReminderType[] {
    const reminders: ReminderType[] = [];
    if (!userActivity.hasIncome) reminders.push('income');
    if (!userActivity.hasExpense) reminders.push('expense');
    if (!userActivity.hasSavings) reminders.push('savings');
    return reminders;
  }

  async sendSpecificReminder(userEmail: string, reminderType: ReminderType): Promise<void> {
    try {
      const messages = this.reminderMessages[reminderType] ?? this.reminderMessages.general;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      await this.notificationService.sendNotificationToUsers([userEmail], {
        type: 'reminder',
        title: `${this.getReminderEmoji(reminderType)} Daily Reminder`,
        body: randomMessage,
        data: {
          type: 'reminder',
          reminderType,
          action: `add_${reminderType}`,
          url:
            reminderType === 'income'
              ? 'trackaexpense://income/add'
              : reminderType === 'expense'
              ? 'trackaexpense://expense/add'
              : reminderType === 'savings'
              ? 'trackaexpense://savings'
              : 'trackaexpense://home',
        },
        icon: this.getReminderEmoji(reminderType),
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to send specific reminder:', error);
    }
  }

  async sendPositiveReminder(userEmail: string): Promise<void> {
    try {
      const positiveMessages = [
        '🎉 Great job! You\'re staying on top of your finances today!',
        '👏 You\'re doing amazing! Keep up the good work with your financial tracking!',
        '🌟 Consistency is key! You\'re building great financial habits!',
        '💪 You\'re on fire! Your financial discipline is impressive!',
        '🏆 Well done! You\'re taking control of your financial future!',
      ];
      const randomMessage = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
      await this.notificationService.sendNotificationToUsers([userEmail], {
        type: 'positive_reminder',
        title: '🎉 Great Job!',
        body: randomMessage,
        data: {type: 'positive_reminder', action: 'view_dashboard', url: 'trackaexpense://home'},
        icon: '🎉',
        priority: 'low',
      });
    } catch (error) {
      console.error('Failed to send positive reminder:', error);
    }
  }

  getReminderEmoji(reminderType: string): string {
    const emojis: Record<string, string> = {
      income: '💰', expense: '💸', savings: '🏦', general: '📱',
    };
    return emojis[reminderType] ?? '📱';
  }

  async logReminderSent(userId: string, date: string, reminderTypes: ReminderType[]): Promise<void> {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('reminderLogs')
        .doc(date)
        .set({date, reminderTypes, sentAt: firestore.FieldValue.serverTimestamp()});
    } catch (error) {
      console.error('Failed to log reminder:', error);
    }
  }

  async sendWeeklySummaryReminder(userEmail: string): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const weekStart = moment().startOf('week').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('week').format('YYYY-MM-DD');
      const summaryCheck = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`weekly_${weekStart}`)
        .get();
      if (summaryCheck.exists) return;
      const weeklyActivity = await this.getWeeklyActivity(currentUser.uid, weekStart, weekEnd);
      await this.notificationService.sendNotificationToUsers([userEmail], {
        type: 'weekly_summary',
        title: '📊 Weekly Summary',
        body: `This week: ${weeklyActivity.incomeCount} income, ${weeklyActivity.expenseCount} expenses, ${weeklyActivity.savingsCount} savings`,
        data: {type: 'weekly_summary', weekStart, weekEnd, activity: weeklyActivity, url: 'trackaexpense://statistic'},
        icon: '📊',
        priority: 'normal',
      });
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`weekly_${weekStart}`)
        .set({type: 'weekly_summary', weekStart, weekEnd, sentAt: firestore.FieldValue.serverTimestamp()});
    } catch (error) {
      console.error('Failed to send weekly summary:', error);
    }
  }

  async getWeeklyActivity(userId: string, weekStart: string, weekEnd: string): Promise<WeeklyActivity> {
    try {
      const startDate = moment(weekStart).startOf('day').toDate();
      const endDate = moment(weekEnd).endOf('day').toDate();
      const [incomeSnapshot, expenseSnapshot, savingsSnapshot] = await Promise.all([
        firestore().collection('users').doc(userId).collection('income')
          .where('date', '>=', startDate).where('date', '<=', endDate).get(),
        firestore().collection('users').doc(userId).collection('expenses')
          .where('date', '>=', startDate).where('date', '<=', endDate).get(),
        firestore().collection('users').doc(userId).collection('savings')
          .where('date', '>=', startDate).where('date', '<=', endDate).get(),
      ]);
      return {incomeCount: incomeSnapshot.size, expenseCount: expenseSnapshot.size, savingsCount: savingsSnapshot.size};
    } catch (error) {
      console.error('Failed to get weekly activity:', error);
      return {incomeCount: 0, expenseCount: 0, savingsCount: 0};
    }
  }

  async sendMonthlyGoalReminder(userEmail: string): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const monthStart = moment().startOf('month').format('YYYY-MM-DD');
      const monthEnd = moment().endOf('month').format('YYYY-MM-DD');
      const goalCheck = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`monthly_goal_${monthStart}`)
        .get();
      if (goalCheck.exists) return;
      await this.notificationService.sendNotificationToUsers([userEmail], {
        type: 'monthly_goal',
        title: '🎯 Monthly Goal Check',
        body: 'How are you doing with your monthly financial goals? Time to review and adjust!',
        data: {type: 'monthly_goal', monthStart, monthEnd, action: 'view_goals', url: 'trackaexpense://statistic'},
        icon: '🎯',
        priority: 'normal',
      });
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`monthly_goal_${monthStart}`)
        .set({type: 'monthly_goal', monthStart, monthEnd, sentAt: firestore.FieldValue.serverTimestamp()});
    } catch (error) {
      console.error('Failed to send monthly goal reminder:', error);
    }
  }

  async sendSavingsGoalReminder(goal: SavingsGoalRef, userId: string): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const frequency = goal.reminderFrequency ?? 'weekly';
      const periodKey =
        frequency === 'weekly'
          ? moment().startOf('week').format('YYYY-MM-DD')
          : moment().startOf('month').format('YYYY-MM-DD');
      const logDocId = `savings_${goal.id}_${periodKey}`;
      const alreadySent = await firestore()
        .collection('users').doc(userId).collection('reminderLogs').doc(logDocId).get();
      if (alreadySent.exists) return;
      const progress = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
      const userEmail = currentUser.email!;
      await this.notificationService.sendNotificationToUsers([userEmail], {
        type: 'savings_reminder',
        title: `💰 ${goal.name} reminder`,
        body: `You've saved ${progress.toFixed(0)}% of your goal. Keep it up!`,
        data: {type: 'savings_reminder', goalId: goal.id, action: 'view_savings', url: 'trackaexpense://savings'},
        icon: '💰',
        priority: 'normal',
      });
      await firestore()
        .collection('users').doc(userId).collection('reminderLogs').doc(logDocId)
        .set({type: 'savings_reminder', goalId: goal.id, goalName: goal.name, frequency, sentAt: firestore.FieldValue.serverTimestamp()});
    } catch (error) {
      console.error('Failed to send savings goal reminder:', error);
    }
  }

  async processRecurringSplits(): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;
      const now = firestore.Timestamp.now();
      const groupsSnap = await firestore()
        .collection('groups')
        .where('members', 'array-contains', currentUser.email)
        .get();
      for (const groupDoc of groupsSnap.docs) {
        try {
          const splitsSnap = await firestore()
            .collection('groups').doc(groupDoc.id).collection('splits')
            .where('recurring.enabled', '==', true).get();
          for (const splitDoc of splitsSnap.docs) {
            const split = splitDoc.data();
            const nextDate = split.recurring?.nextDate;
            if (!nextDate || nextDate.toMillis() > now.toMillis()) continue;
            if (split.paidBy?.userId !== currentUser.uid) continue;
            const frequency = split.recurring?.frequency || 'monthly';
            const nextDateJs = nextDate.toDate() as Date;
            const newNextDate =
              frequency === 'weekly'
                ? new Date(nextDateJs.getTime() + 7 * 24 * 60 * 60 * 1000)
                : new Date(nextDateJs.getFullYear(), nextDateJs.getMonth() + 1, nextDateJs.getDate());
            const newSplitData = {
              title: split.title,
              amount: split.amount,
              paidBy: split.paidBy,
              splitType: split.splitType || 'equal',
              splitUsers: split.splitUsers || [],
              category: split.category || null,
              notes: split.notes || null,
              date: firestore.Timestamp.fromDate(nextDateJs),
              createdAt: now,
              recurring: {
                enabled: true,
                frequency,
                nextDate: firestore.Timestamp.fromDate(newNextDate),
              },
            };
            await firestore()
              .collection('groups').doc(groupDoc.id).collection('splits').add(newSplitData);
            await splitDoc.ref.update({'recurring.nextDate': firestore.Timestamp.fromDate(newNextDate)});
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
}

export default new ReminderNotificationService();
