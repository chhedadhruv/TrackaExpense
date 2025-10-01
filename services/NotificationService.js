import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import notifee, {AndroidImportance, EventType} from '@notifee/react-native';
import {Platform, PermissionsAndroid, Alert} from 'react-native';
import * as RootNavigation from '../navigation/Routes';
import {NOTIFICATION_SERVER_URL, EXPO_PUBLIC_NOTIFICATION_SERVER_URL} from '@env';

class NotificationService {
  constructor() {
    this.fcmToken = null;
    this.isInitialized = false;
    this.sentNotifications = new Set(); // Track sent notifications to prevent duplicates
    this.sendingInProgress = new Set(); // Track notifications currently being sent
  }

  // Initialize notification service
  async initialize() {
    try {
      await this.requestPermission();
      await this.getFCMToken();
      await this.setupMessageHandlers();
      await this.setupNotifeeEventHandlers();
      await this.saveTokenToFirestore();
      this.isInitialized = true;
      console.log('NotificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
    }
  }

  // Request notification permissions
  async requestPermission() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'TrackaExpense needs notification permission to send you updates about splits and reminders.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Notification permission denied');
      }
    }

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      throw new Error('Notification permission not granted');
    }
  }

  // Get FCM token
  async getFCMToken() {
    try {
      this.fcmToken = await messaging().getToken();
      console.log('FCM Token:', this.fcmToken);
      return this.fcmToken;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      throw error;
    }
  }

  // Save token to Firestore
  async saveTokenToFirestore() {
    if (!this.fcmToken || !auth().currentUser) return;

    try {
      await firestore()
        .collection('users')
        .doc(auth().currentUser.uid)
        .update({
          fcmToken: this.fcmToken,
          lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Failed to save FCM token:', error);
    }
  }

  // Setup message handlers
  setupMessageHandlers() {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      // Don't show local notification - let OS handle server notifications
      // This prevents duplicates when server sends notification payload
    });

    // Handle foreground messages
    messaging().onMessage(async remoteMessage => {
      // Always show local notification when app is open (OS doesn't show server notifications in foreground)
      await this.showLocalNotification(remoteMessage);
    });

    // Handle notification tap
    messaging().onNotificationOpenedApp(remoteMessage => {
      this.handleNotificationTap(remoteMessage.data);
    });

    // Handle notification tap when app is closed
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          this.handleNotificationTap(remoteMessage.data);
        }
      });
  }

  // Setup notifee event handlers for local notifications
  setupNotifeeEventHandlers() {
    // Handle notification press events
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        this.handleNotificationTap(detail.notification?.data);
      }
    });

    // Handle background notification press
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        this.handleNotificationTap(detail.notification?.data);
      }
    });
  }

  // Display a local notification when app is in foreground
  async showLocalNotification(remoteMessage) {
    const title = remoteMessage?.notification?.title || 'Notification';
    const body = remoteMessage?.notification?.body || 'You have a new message';
    const data = remoteMessage?.data || {};

    // Ensure Android channel exists (HIGH importance = heads-up banner)
    let channelId = 'trackaexpense_default_alerts';
    if (Platform.OS === 'android') {
      channelId = await notifee.createChannel({
        id: 'trackaexpense_default_alerts',
        name: 'TrackaExpense Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        lights: true,
      });
    }

    await notifee.displayNotification({
      title,
      body,
      data,
      android: Platform.OS === 'android' ? {
        channelId,
        smallIcon: 'ic_notification', // Use your app's notification icon
        largeIcon: 'ic_launcher',     // Use your app icon as large icon
        pressAction: { id: 'default' },
        importance: AndroidImportance.HIGH,
      } : undefined,
      ios: {
        // Show banner in foreground and add to list with sound
        foregroundPresentationOptions: {
          banner: true,
          list: true,
          sound: true,
        },
      },
    });
  }

  // Handle notification tap
  handleNotificationTap(data) {
    if (!data) return;

    try {
      // Navigate based on notification type
      switch (data.type) {
        case 'split_invite':
        case 'group_created':
          // Navigate to Invitations screen for new group invites
          RootNavigation.navigate('Split', {
            screen: 'Invitations',
          });
          break;

        case 'split_created':
        case 'split_updated':
        case 'split_deleted':
        case 'settlement_made':
          // Navigate to split group detail if we have groupId
          if (data.groupId) {
            // First navigate to Split tab, then to the group detail
            RootNavigation.navigate('Split', {
              screen: 'SplitGroupDetail',
              params: {
                group: {
                  id: data.groupId,
                  name: data.groupName || 'Split Group',
                },
              },
            });
          }
          break;

        case 'user_joined_group':
        case 'user_left_group':
        case 'group_updated':
          // Navigate to split group detail
          if (data.groupId) {
            RootNavigation.navigate('Split', {
              screen: 'SplitGroupDetail',
              params: {
                group: {
                  id: data.groupId,
                  name: data.groupName || 'Split Group',
                },
              },
            });
          }
          break;

        case 'group_deleted':
          // Navigate to main split screen
          RootNavigation.navigate('Split', {
            screen: 'Split',
          });
          break;

        case 'reminder':
          // Navigate to home screen
          RootNavigation.navigate('Home', {
            screen: 'Home',
          });
          break;

        case 'fun_notification':
          // Navigate to home screen
          RootNavigation.navigate('Home', {
            screen: 'Home',
          });
          break;

        default:
          // Default to home screen
          RootNavigation.navigate('Home', {
            screen: 'Home',
          });
          break;
      }
    } catch (error) {
      console.error('Failed to handle notification tap:', error);
    }
  }

  // Send notification to specific users
  async sendNotificationToUsers(userEmails, notificationData) {
    try {
      // Create a unique key for this notification to prevent duplicates
      const notificationKey = `${notificationData.type}_${notificationData.data?.splitId || notificationData.data?.groupId}_${userEmails.sort().join(',')}`;
      
      if (this.sentNotifications.has(notificationKey)) {
        return;
      }
      
      if (this.sendingInProgress.has(notificationKey)) {
        return;
      }
      
      this.sendingInProgress.add(notificationKey);
      this.sentNotifications.add(notificationKey);
      
      // Clear old notifications after 5 minutes to prevent memory buildup
      setTimeout(() => {
        this.sentNotifications.delete(notificationKey);
        this.sendingInProgress.delete(notificationKey);
      }, 5 * 60 * 1000);
      
      const usersSnapshot = await firestore()
        .collection('users')
        .where('email', 'in', userEmails)
        .get();

    const tokens = [];
    const seenTokens = new Set();
    const userTokens = new Map(); // Map email to their latest token
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken && !seenTokens.has(userData.fcmToken)) {
        // Only keep the latest token per user (prevent multiple devices)
        const userEmail = userData.email;
        if (!userTokens.has(userEmail) || userData.lastTokenUpdate > userTokens.get(userEmail).lastTokenUpdate) {
          userTokens.set(userEmail, {
            token: userData.fcmToken,
            lastTokenUpdate: userData.lastTokenUpdate || 0
          });
        }
        seenTokens.add(userData.fcmToken);
      }
    });
    
    // Extract only the latest token per user
    userTokens.forEach(({token}) => {
      tokens.push(token);
    });

      if (tokens.length === 0) {
        return;
      }

      // Try to send push via backend if configured
      const sent = await this.trySendPushViaBackend(tokens, notificationData);
      if (!sent) {
        // Fallback: store in Firestore (inbox pattern)
        await this.storeNotificationInFirestore(userEmails, notificationData);
      }
      
      // Clean up sending in progress
      this.sendingInProgress.delete(notificationKey);
    } catch (error) {
      console.error('Failed to send notification:', error);
      // Clean up sending in progress on error
      this.sendingInProgress.delete(notificationKey);
    }
  }

  // Attempt to send push via backend endpoint; returns true on success
  async trySendPushViaBackend(tokens, notificationData) {
    try {
      const endpoint = NOTIFICATION_SERVER_URL || EXPO_PUBLIC_NOTIFICATION_SERVER_URL || '';
      if (!endpoint) {
        return false;
      }
      
      const payload = {
        tokens,
        notification: {
          title: notificationData.title || 'Notification',
          body: notificationData.body || '',
        },
        data: notificationData.data || {},
      };
      
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        return false;
      }
      const json = await res.json();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Store notification in Firestore for users to read
  async storeNotificationInFirestore(userEmails, notificationData) {
    try {
      const batch = firestore().batch();
      
      userEmails.forEach(email => {
        const notificationRef = firestore()
          .collection('users')
          .doc(email.replace('@', '_at_')) // Replace @ with _at_ for document ID
          .collection('notifications')
          .doc();

        batch.set(notificationRef, {
          ...notificationData,
          createdAt: firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  // Get user's notifications
  async getUserNotifications(userEmail) {
    try {
      const notificationsSnapshot = await firestore()
        .collection('users')
        .doc(userEmail.replace('@', '_at_'))
        .collection('notifications')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      return notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId, userEmail) {
    try {
      await firestore()
        .collection('users')
        .doc(userEmail.replace('@', '_at_'))
        .collection('notifications')
        .doc(notificationId)
        .update({
          read: true,
          readAt: firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  // Clear all notifications
  async clearAllNotifications(userEmail) {
    try {
      const notificationsSnapshot = await firestore()
        .collection('users')
        .doc(userEmail.replace('@', '_at_'))
        .collection('notifications')
        .get();

      const batch = firestore().batch();
      notificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
}

export default new NotificationService();
