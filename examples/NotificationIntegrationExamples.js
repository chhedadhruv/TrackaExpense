// Example integration code for TrackaExpense notification system
// This file shows how to integrate the notification services into your existing screens

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Import notification services
import NotificationService from '../services/NotificationService';
import SplitNotificationService from '../services/SplitNotificationService';
import ReminderNotificationService from '../services/ReminderNotificationService';
import FunNotificationService from '../services/FunNotificationService';

// Example 1: Initialize notifications in App.tsx
export const AppInitialization = () => {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize notification service when app starts
        await NotificationService.initialize();
        console.log('Notification system initialized');
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeApp();
  }, []);

  return null; // This is just for initialization
};

// Example 2: Integrate split notifications in CreateSplitScreen.js
export const CreateSplitScreenIntegration = {
  // Add this to your handleSubmit function in CreateSplitScreen.js
  handleSubmit: async (splitData, groupData, isEditMode) => {
    try {
      const currentUser = auth().currentUser;
      const actorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Someone';

      if (isEditMode) {
        // Update existing split
        await firestore()
          .collection('groups')
          .doc(groupData.id)
          .collection('splits')
          .doc(splitData.id)
          .update(splitData);

        // Send split updated notification
        await SplitNotificationService.notifySplitUpdated(
          splitData,
          groupData,
          actorName,
          { amount: splitData.amount, title: splitData.title }
        );
      } else {
        // Create new split
        const splitRef = await firestore()
          .collection('groups')
          .doc(groupData.id)
          .collection('splits')
          .add(splitData);

        // Send split created notification
        await SplitNotificationService.notifySplitCreated(
          { ...splitData, id: splitRef.id },
          groupData,
          actorName
        );
      }
    } catch (error) {
      console.error('Failed to handle split submission:', error);
    }
  },

  // Add this to your handleDeleteSplit function
  handleDeleteSplit: async (splitData, groupData) => {
    try {
      const currentUser = auth().currentUser;
      const actorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Someone';

      // Delete split from Firestore
      await firestore()
        .collection('groups')
        .doc(groupData.id)
        .collection('splits')
        .doc(splitData.id)
        .delete();

      // Send split deleted notification
      await SplitNotificationService.notifySplitDeleted(
        splitData,
        groupData,
        actorName
      );
    } catch (error) {
      console.error('Failed to delete split:', error);
    }
  }
};

// Example 3: Integrate group notifications in SplitScreen.js
export const SplitScreenIntegration = {
  // Add this to your createGroup function
  createGroup: async (groupData, selectedUsers) => {
    try {
      const currentUser = auth().currentUser;
      const actorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Someone';

      // Create group in Firestore
      const groupRef = await firestore()
        .collection('groups')
        .add(groupData);

      // Send group created notification to invited users
      await SplitNotificationService.notifyGroupCreated(
        { ...groupData, id: groupRef.id },
        actorName
      );

      // Send individual invite notifications
      for (const user of selectedUsers) {
        if (user.email) {
          await SplitNotificationService.notifySplitInvite(
            { ...groupData, id: groupRef.id },
            actorName,
            user.email
          );
        }
      }
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  },

  // Add this to your handleEditGroup function
  handleEditGroup: async (groupData, changes) => {
    try {
      const currentUser = auth().currentUser;
      const actorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Someone';

      // Update group in Firestore
      await firestore()
        .collection('groups')
        .doc(groupData.id)
        .update(groupData);

      // Send group updated notification
      await SplitNotificationService.notifyGroupUpdated(
        groupData,
        actorName,
        changes
      );
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  }
};

// Example 4: Integrate reminder notifications in HomeScreen.js
export const HomeScreenIntegration = {
  // Add this to your HomeScreen component
  setupDailyReminders: async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Check if it's time to send daily reminders (e.g., 9 AM)
      const now = new Date();
      const reminderTime = new Date();
      reminderTime.setHours(9, 0, 0, 0);

      if (now.getTime() >= reminderTime.getTime()) {
        await ReminderNotificationService.sendDailyReminders();
      }

      // Check if it's time to send weekly summary (e.g., Sunday)
      if (now.getDay() === 0) {
        await ReminderNotificationService.sendWeeklySummaryReminder(currentUser.email);
      }

      // Check if it's time to send monthly goal reminder (e.g., 1st of month)
      if (now.getDate() === 1) {
        await ReminderNotificationService.sendMonthlyGoalReminder(currentUser.email);
      }
    } catch (error) {
      console.error('Failed to setup reminders:', error);
    }
  },

  // Add this to your componentDidMount or useEffect
  componentDidMount: () => {
    // Setup reminders when component mounts
    HomeScreenIntegration.setupDailyReminders();
  }
};

// Example 5: Integrate fun notifications
export const FunNotificationIntegration = {
  // Add this to your HomeScreen or main component
  setupFunNotifications: async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay();

      // Send fun notifications at different times
      if (currentHour === 10) {
        // Morning fun notification
        await FunNotificationService.sendFunNotification(currentUser.email, 'morning');
      } else if (currentHour === 15) {
        // Afternoon fun notification
        await FunNotificationService.sendFunNotification(currentUser.email, 'afternoon');
      } else if (currentHour === 20) {
        // Evening fun notification
        await FunNotificationService.sendFunNotification(currentUser.email, 'evening');
      }

      // Weekend special notifications
      if (currentDay === 0 || currentDay === 6) {
        await FunNotificationService.sendFunNotification(currentUser.email, 'weekend');
      }

      // Random fun notifications (occasionally)
      if (Math.random() < 0.1) { // 10% chance
        await FunNotificationService.sendRandomFunNotification(currentUser.email);
      }
    } catch (error) {
      console.error('Failed to setup fun notifications:', error);
    }
  }
};

// Example 6: Handle notification taps
export const NotificationTapHandler = {
  // Add this to your navigation setup
  handleNotificationTap: (remoteMessage) => {
    const { data } = remoteMessage;
    if (!data) return;

    switch (data.type) {
      case 'split_created':
      case 'split_updated':
      case 'split_deleted':
      case 'split_invite':
        // Navigate to split group detail
        // navigation.navigate('SplitGroupDetail', { groupId: data.groupId });
        break;
      case 'reminder':
        // Navigate to add expense/income screen
        // navigation.navigate('AddExpense');
        break;
      case 'fun_notification':
        // Navigate to home screen
        // navigation.navigate('Home');
        break;
      default:
        break;
    }
  }
};

// Example 7: User notification preferences
export const NotificationPreferences = {
  // Add this to your ProfileScreen or SettingsScreen
  updateNotificationPreferences: async (preferences) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({
          notificationPreferences: {
            splitNotifications: preferences.splitNotifications,
            reminderNotifications: preferences.reminderNotifications,
            funNotifications: preferences.funNotifications,
            reminderTime: preferences.reminderTime, // e.g., '09:00'
            updatedAt: firestore.FieldValue.serverTimestamp(),
          }
        });
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  },

  // Get user notification preferences
  getUserNotificationPreferences: async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return null;

      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();

      return userDoc.data()?.notificationPreferences || {
        splitNotifications: true,
        reminderNotifications: true,
        funNotifications: true,
        reminderTime: '09:00',
      };
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return null;
    }
  }
};

// Example 8: Notification history
export const NotificationHistory = {
  // Add this to your ProfileScreen or a dedicated NotificationsScreen
  getNotificationHistory: async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return [];

      return await NotificationService.getUserNotifications(currentUser.email);
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      await NotificationService.markNotificationAsRead(notificationId, currentUser.email);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  // Clear all notifications
  clearAllNotifications: async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      await NotificationService.clearAllNotifications(currentUser.email);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
};

// Example 9: Testing functions
export const NotificationTesting = {
  // Test notification permissions
  testPermissions: async () => {
    try {
      await NotificationService.requestPermission();
      console.log('Permissions granted');
    } catch (error) {
      console.error('Permissions denied:', error);
    }
  },

  // Test FCM token
  testFCMToken: async () => {
    try {
      const token = await NotificationService.getFCMToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  },

  // Test sending a notification
  testNotification: async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      await NotificationService.sendNotificationToUsers(
        [currentUser.email],
        {
          type: 'test',
          title: 'Test Notification 🧪',
          body: 'This is a test notification from TrackaExpense',
          data: { type: 'test' },
          icon: '🧪',
          priority: 'normal',
        }
      );
      console.log('Test notification sent');
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  }
};

export default {
  AppInitialization,
  CreateSplitScreenIntegration,
  SplitScreenIntegration,
  HomeScreenIntegration,
  FunNotificationIntegration,
  NotificationTapHandler,
  NotificationPreferences,
  NotificationHistory,
  NotificationTesting,
};
