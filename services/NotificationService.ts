import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
} from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {reportError} from '../src/services/ErrorReporter';
import notifee, {AndroidImportance, EventType} from '@notifee/react-native';
import {Platform, PermissionsAndroid} from 'react-native';
import * as RootNavigation from '../navigation/Routes';
import {
  NOTIFICATION_SERVER_URL,
  EXPO_PUBLIC_NOTIFICATION_SERVER_URL,
} from '@env';

interface NotificationData {
  type?: string;
  action?: string;
  groupId?: string;
  groupName?: string;
  splitId?: string;
  [key: string]: unknown;
}

interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  data: NotificationData;
  icon?: string;
  priority?: string;
}

notifee.onBackgroundEvent(async ({type, detail}) => {
  if (type === EventType.PRESS && detail.notification?.data) {
    setTimeout(() => {
      handleNotificationNavigation(
        detail.notification?.data as NotificationData,
      );
    }, 1000);
  }
});

function handleNotificationNavigation(
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

class NotificationService {
  private fcmToken: string | null;
  private isInitialized: boolean;
  private sentNotifications: Set<string>;
  private sendingInProgress: Set<string>;

  constructor() {
    this.fcmToken = null;
    this.isInitialized = false;
    this.sentNotifications = new Set();
    this.sendingInProgress = new Set();
  }

  async initialize(): Promise<void> {
    try {
      await this.requestPermission();
      await this.getFCMToken();
      await this.setupMessageHandlers();
      await this.setupNotifeeEventHandlers();
      await this.saveTokenToFirestore();
      this.isInitialized = true;
    } catch (error) {
      reportError(error as Error);
      console.error('Failed to initialize NotificationService:', error);
    }
  }

  async requestPermission(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
        if (permission) {
          const alreadyGranted = await PermissionsAndroid.check(permission);
          if (!alreadyGranted) {
            await PermissionsAndroid.request(permission, {
              title: 'Notification Permission',
              message:
                'TrackaExpense needs notification permission to send you updates about splits and reminders.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            });
          }
        }
      } catch (_) {
        // Activity not yet attached or permission API unavailable — skip
      }
    }
    const authStatus = await requestPermission(getMessaging());
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    if (!enabled) {
      throw new Error('Notification permission not granted');
    }
  }

  async getFCMToken(): Promise<string | null> {
    try {
      this.fcmToken = await getToken(getMessaging());
      return this.fcmToken;
    } catch (error) {
      reportError(error as Error);
      console.error('Failed to get FCM token:', error);
      throw error;
    }
  }

  async saveTokenToFirestore(): Promise<void> {
    if (!this.fcmToken || !auth().currentUser) {
      return;
    }
    try {
      await firestore()
        .collection('users')
        .doc(auth().currentUser!.uid)
        .update({
          fcmToken: this.fcmToken,
          lastTokenUpdate: firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      reportError(error as Error);
      console.error('Failed to save FCM token:', error);
    }
  }

  setupMessageHandlers(): void {
    onMessage(getMessaging(), async remoteMessage => {
      await this.showLocalNotification(remoteMessage);
    });
  }

  setupNotifeeEventHandlers(): void {
    notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS) {
        this.handleNotificationTap(
          detail.notification?.data as NotificationData,
        );
      }
    });
  }

  async showLocalNotification(remoteMessage: any): Promise<void> {
    const title = remoteMessage?.notification?.title || 'Notification';
    const body = remoteMessage?.notification?.body || 'You have a new message';
    const data = remoteMessage?.data || {};

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
      android:
        Platform.OS === 'android'
          ? {
              channelId,
              smallIcon: 'ic_notification',
              largeIcon: 'ic_launcher',
              pressAction: {id: 'default'},
              importance: AndroidImportance.HIGH,
            }
          : undefined,
      ios: {
        foregroundPresentationOptions: {banner: true, list: true, sound: true},
      },
    });
  }

  handleNotificationTap(data: NotificationData | undefined): void {
    handleNotificationNavigation(data);
  }

  async sendNotificationToUsers(
    userEmails: string[],
    notificationData: NotificationPayload,
  ): Promise<void> {
    try {
      const notificationKey = `${notificationData.type}_${
        notificationData.data?.splitId || notificationData.data?.groupId
      }_${userEmails.sort().join(',')}`;
      if (this.sentNotifications.has(notificationKey)) {
        return;
      }
      if (this.sendingInProgress.has(notificationKey)) {
        return;
      }

      this.sendingInProgress.add(notificationKey);
      this.sentNotifications.add(notificationKey);
      setTimeout(() => {
        this.sentNotifications.delete(notificationKey);
        this.sendingInProgress.delete(notificationKey);
      }, 5 * 60 * 1000);

      const usersSnapshot = await firestore()
        .collection('users')
        .where('email', 'in', userEmails)
        .get();

      const tokens: string[] = [];
      const seenTokens = new Set<string>();
      const userTokens = new Map<
        string,
        {token: string; lastTokenUpdate: number}
      >();

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmToken && !seenTokens.has(userData.fcmToken)) {
          const userEmail = userData.email as string;
          if (
            !userTokens.has(userEmail) ||
            userData.lastTokenUpdate >
              userTokens.get(userEmail)!.lastTokenUpdate
          ) {
            userTokens.set(userEmail, {
              token: userData.fcmToken,
              lastTokenUpdate: userData.lastTokenUpdate || 0,
            });
          }
          seenTokens.add(userData.fcmToken);
        }
      });
      userTokens.forEach(({token}) => tokens.push(token));

      if (tokens.length === 0) {
        return;
      }

      const sent = await this.trySendPushViaBackend(tokens, notificationData);
      if (!sent) {
        await this.storeNotificationInFirestore(userEmails, notificationData);
      }
      this.sendingInProgress.delete(notificationKey);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  private async trySendPushViaBackend(
    tokens: string[],
    notificationData: NotificationPayload,
  ): Promise<boolean> {
    try {
      const endpoint =
        NOTIFICATION_SERVER_URL || EXPO_PUBLIC_NOTIFICATION_SERVER_URL || '';
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
      const res = await fetch(
        `${endpoint.replace(/\/$/, '')}/send-notification`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        return false;
      }
      await res.json();
      return true;
    } catch (_) {
      return false;
    }
  }

  private async storeNotificationInFirestore(
    userEmails: string[],
    notificationData: NotificationPayload,
  ): Promise<void> {
    try {
      const batch = firestore().batch();
      userEmails.forEach(email => {
        const ref = firestore()
          .collection('users')
          .doc(email.replace('@', '_at_'))
          .collection('notifications')
          .doc();
        batch.set(ref, {
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

  async getUserNotifications(userEmail: string): Promise<any[]> {
    try {
      const snapshot = await firestore()
        .collection('users')
        .doc(userEmail.replace('@', '_at_'))
        .collection('notifications')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      return [];
    }
  }

  async markNotificationAsRead(
    notificationId: string,
    userEmail: string,
  ): Promise<void> {
    try {
      await firestore()
        .collection('users')
        .doc(userEmail.replace('@', '_at_'))
        .collection('notifications')
        .doc(notificationId)
        .update({read: true, readAt: firestore.FieldValue.serverTimestamp()});
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async clearAllNotifications(userEmail: string): Promise<void> {
    try {
      const snapshot = await firestore()
        .collection('users')
        .doc(userEmail.replace('@', '_at_'))
        .collection('notifications')
        .get();
      const batch = firestore().batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
}

export default new NotificationService();
