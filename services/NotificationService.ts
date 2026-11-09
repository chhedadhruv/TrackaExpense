import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  requestPermission,
} from '@react-native-firebase/messaging';
import {
  collection,
  doc as fsDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../src/services/ErrorReporter';
import {sendPush} from '../src/services/PushSender';
import {Platform, PermissionsAndroid} from 'react-native';
import type {NotificationData} from './NotificationNavigation';

interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  data: NotificationData;
  icon?: string;
  priority?: string;
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
    if (!this.fcmToken || !getAuth().currentUser) {
      return;
    }
    try {
      await updateDoc(
        fsDoc(getFirestore(), 'users', getAuth().currentUser!.uid),
        {
          fcmToken: this.fcmToken,
          lastTokenUpdate: serverTimestamp(),
        },
      );
    } catch (error) {
      reportError(error as Error);
      console.error('Failed to save FCM token:', error);
    }
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

      // The server checks who may be notified, sends through OneSignal by uid, and keeps an
      // in-app copy if the push cannot be delivered. No token is read or sent from the device.
      const groupId =
        typeof notificationData.data?.groupId === 'string'
          ? notificationData.data.groupId
          : undefined;
      await sendPush({
        emails: userEmails,
        type: notificationData.type,
        title: notificationData.title,
        body: notificationData.body,
        data: notificationData.data ?? {},
        ...(groupId ? {groupId} : {}),
        ...(notificationData.icon ? {icon: notificationData.icon} : {}),
        ...(notificationData.priority
          ? {priority: notificationData.priority}
          : {}),
      });
      this.sendingInProgress.delete(notificationKey);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async getUserNotifications(userEmail: string): Promise<any[]> {
    try {
      const snapshot = await getDocs(
        query(
          collection(
            getFirestore(),
            'users',
            userEmail.replace('@', '_at_'),
            'notifications',
          ),
          orderBy('createdAt', 'desc'),
          limit(50),
        ),
      );
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
      await updateDoc(
        fsDoc(
          getFirestore(),
          'users',
          userEmail.replace('@', '_at_'),
          'notifications',
          notificationId,
        ),
        {read: true, readAt: serverTimestamp()},
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async clearAllNotifications(userEmail: string): Promise<void> {
    try {
      const snapshot = await getDocs(
        collection(
          getFirestore(),
          'users',
          userEmail.replace('@', '_at_'),
          'notifications',
        ),
      );
      const batch = writeBatch(getFirestore());
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
}

export default new NotificationService();
