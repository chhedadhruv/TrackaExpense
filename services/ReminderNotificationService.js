import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NotificationService from './NotificationService';
import moment from 'moment';

class ReminderNotificationService {
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

  // Send daily reminder notifications
  async sendDailyReminders() {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const userEmail = currentUser.email;
      const today = moment().format('YYYY-MM-DD');
      
      // Check if user has already received reminder today
      const reminderCheck = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(today)
        .get();

      if (reminderCheck.exists) {
        console.log('User already received reminder today');
        return;
      }

      // Check user's activity for today
      const userActivity = await this.getUserActivityForToday(currentUser.uid, today);
      
      // Determine what reminders to send
      const remindersToSend = this.determineRemindersToSend(userActivity);
      
      if (remindersToSend.length === 0) {
        // User has been active, send a positive message
        await this.sendPositiveReminder(userEmail);
      } else {
        // Send specific reminders
        for (const reminderType of remindersToSend) {
          await this.sendSpecificReminder(userEmail, reminderType);
        }
      }

      // Log that reminder was sent
      await this.logReminderSent(currentUser.uid, today, remindersToSend);
    } catch (error) {
      console.error('Failed to send daily reminders:', error);
    }
  }

  // Get user's activity for today
  async getUserActivityForToday(userId, date) {
    try {
      const startOfDay = moment(date).startOf('day').toDate();
      const endOfDay = moment(date).endOf('day').toDate();

      const [incomeSnapshot, expenseSnapshot, savingsSnapshot] = await Promise.all([
        firestore()
          .collection('users')
          .doc(userId)
          .collection('income')
          .where('date', '>=', startOfDay)
          .where('date', '<=', endOfDay)
          .get(),
        firestore()
          .collection('users')
          .doc(userId)
          .collection('expenses')
          .where('date', '>=', startOfDay)
          .where('date', '<=', endOfDay)
          .get(),
        firestore()
          .collection('users')
          .doc(userId)
          .collection('savings')
          .where('date', '>=', startOfDay)
          .where('date', '<=', endOfDay)
          .get(),
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
      return { hasIncome: false, hasExpense: false, hasSavings: false };
    }
  }

  // Determine what reminders to send based on user activity
  determineRemindersToSend(userActivity) {
    const reminders = [];
    
    if (!userActivity.hasIncome) {
      reminders.push('income');
    }
    if (!userActivity.hasExpense) {
      reminders.push('expense');
    }
    if (!userActivity.hasSavings) {
      reminders.push('savings');
    }
    
    return reminders;
  }

  // Send specific reminder
  async sendSpecificReminder(userEmail, reminderType) {
    try {
      const messages = this.reminderMessages[reminderType] || this.reminderMessages.general;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationData = {
        type: 'reminder',
        title: `${this.getReminderEmoji(reminderType)} Daily Reminder`,
        body: randomMessage,
        data: {
          type: 'reminder',
          reminderType: reminderType,
          action: `add_${reminderType}`,
        },
        icon: this.getReminderEmoji(reminderType),
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
    } catch (error) {
      console.error('Failed to send specific reminder:', error);
    }
  }

  // Send positive reminder for active users
  async sendPositiveReminder(userEmail) {
    try {
      const positiveMessages = [
        '🎉 Great job! You\'re staying on top of your finances today!',
        '👏 You\'re doing amazing! Keep up the good work with your financial tracking!',
        '🌟 Consistency is key! You\'re building great financial habits!',
        '💪 You\'re on fire! Your financial discipline is impressive!',
        '🏆 Well done! You\'re taking control of your financial future!',
      ];

      const randomMessage = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];

      const notificationData = {
        type: 'positive_reminder',
        title: '🎉 Great Job!',
        body: randomMessage,
        data: {
          type: 'positive_reminder',
          action: 'view_dashboard',
        },
        icon: '🎉',
        priority: 'low',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
    } catch (error) {
      console.error('Failed to send positive reminder:', error);
    }
  }

  // Get reminder emoji
  getReminderEmoji(reminderType) {
    const emojis = {
      income: '💰',
      expense: '💸',
      savings: '🏦',
      general: '📱',
    };
    return emojis[reminderType] || '📱';
  }

  // Log reminder sent
  async logReminderSent(userId, date, reminderTypes) {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('reminderLogs')
        .doc(date)
        .set({
          date: date,
          reminderTypes: reminderTypes,
          sentAt: firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Failed to log reminder:', error);
    }
  }

  // Send weekly summary reminder
  async sendWeeklySummaryReminder(userEmail) {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const weekStart = moment().startOf('week').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('week').format('YYYY-MM-DD');

      // Check if user has already received weekly summary
      const summaryCheck = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`weekly_${weekStart}`)
        .get();

      if (summaryCheck.exists) {
        return;
      }

      const weeklyActivity = await this.getWeeklyActivity(currentUser.uid, weekStart, weekEnd);
      
      const notificationData = {
        type: 'weekly_summary',
        title: '📊 Weekly Summary',
        body: `This week: ${weeklyActivity.incomeCount} income, ${weeklyActivity.expenseCount} expenses, ${weeklyActivity.savingsCount} savings`,
        data: {
          type: 'weekly_summary',
          weekStart: weekStart,
          weekEnd: weekEnd,
          activity: weeklyActivity,
        },
        icon: '📊',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
      
      // Log weekly summary sent
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`weekly_${weekStart}`)
        .set({
          type: 'weekly_summary',
          weekStart: weekStart,
          weekEnd: weekEnd,
          sentAt: firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Failed to send weekly summary:', error);
    }
  }

  // Get weekly activity
  async getWeeklyActivity(userId, weekStart, weekEnd) {
    try {
      const startDate = moment(weekStart).startOf('day').toDate();
      const endDate = moment(weekEnd).endOf('day').toDate();

      const [incomeSnapshot, expenseSnapshot, savingsSnapshot] = await Promise.all([
        firestore()
          .collection('users')
          .doc(userId)
          .collection('income')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate)
          .get(),
        firestore()
          .collection('users')
          .doc(userId)
          .collection('expenses')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate)
          .get(),
        firestore()
          .collection('users')
          .doc(userId)
          .collection('savings')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate)
          .get(),
      ]);

      return {
        incomeCount: incomeSnapshot.size,
        expenseCount: expenseSnapshot.size,
        savingsCount: savingsSnapshot.size,
      };
    } catch (error) {
      console.error('Failed to get weekly activity:', error);
      return { incomeCount: 0, expenseCount: 0, savingsCount: 0 };
    }
  }

  // Send monthly goal reminder
  async sendMonthlyGoalReminder(userEmail) {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const monthStart = moment().startOf('month').format('YYYY-MM-DD');
      const monthEnd = moment().endOf('month').format('YYYY-MM-DD');

      // Check if user has already received monthly goal reminder
      const goalCheck = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`monthly_goal_${monthStart}`)
        .get();

      if (goalCheck.exists) {
        return;
      }

      const notificationData = {
        type: 'monthly_goal',
        title: '🎯 Monthly Goal Check',
        body: 'How are you doing with your monthly financial goals? Time to review and adjust!',
        data: {
          type: 'monthly_goal',
          monthStart: monthStart,
          monthEnd: monthEnd,
          action: 'view_goals',
        },
        icon: '🎯',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
      
      // Log monthly goal reminder sent
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`monthly_goal_${monthStart}`)
        .set({
          type: 'monthly_goal',
          monthStart: monthStart,
          monthEnd: monthEnd,
          sentAt: firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Failed to send monthly goal reminder:', error);
    }
  }
}

export default new ReminderNotificationService();
