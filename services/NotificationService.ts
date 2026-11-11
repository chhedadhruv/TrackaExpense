import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  hasPermission,
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
      if (!(await this.isPermissionGranted())) {
        return;
      }
      await this.getFCMToken();
      await this.saveTokenToFirestore();
      this.isInitialized = true;
    } catch (error) {
      reportError(error as Error);
      console.error('Failed to initialize NotificationService:', error);
    }
  }

  /**
   * Reads the notification permission without asking for it. The only permission prompt is the
   * OneSignal one, shown after the first saved expense (src/services/PushService.ts); asking here
   * as well showed a second dialog at every start, and its Cancel still led to the system prompt.
   */
  async isPermissionGranted(): Promise<boolean> {
    const authStatus = await hasPermission(getMessaging());
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    );
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
