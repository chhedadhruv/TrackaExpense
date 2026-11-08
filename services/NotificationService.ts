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
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../src/services/ErrorReporter';
import {Platform, PermissionsAndroid} from 'react-native';
import {
  NOTIFICATION_SERVER_URL,
  EXPO_PUBLIC_NOTIFICATION_SERVER_URL,
} from '@env';
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

      const usersSnapshot = await getDocs(
        query(
          collection(getFirestore(), 'users'),
          where('email', 'in', userEmails),
        ),
      );

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
      const batch = writeBatch(getFirestore());
      userEmails.forEach(email => {
        const ref = fsDoc(
          collection(
            getFirestore(),
            'users',
            email.replace('@', '_at_'),
            'notifications',
          ),
        );
        batch.set(ref, {
          ...notificationData,
          createdAt: serverTimestamp(),
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
