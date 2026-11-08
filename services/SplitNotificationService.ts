import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NotificationService from './NotificationService';
import type {GroupDocument, SplitDocument} from '../src/types';

interface PaymentReminderResult {
  success: boolean;
  reason?: string;
}

interface PersonRef {
  email: string;
  name: string;
  userId?: string;
}

class SplitNotificationService {
  private notificationService: typeof NotificationService;

  constructor() {
    this.notificationService = NotificationService;
  }

  async notifySplitCreated(
    splitData: Pick<SplitDocument, 'id' | 'title' | 'amount'>,
    groupData: GroupDocument & {pendingInvites?: string[]},
    creatorName: string,
  ): Promise<void> {
    try {
      const allUsers = [
        ...(groupData.members || []),
        ...(groupData.pendingInvites || []),
      ];
      const usersToNotify = [...new Set(allUsers)].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'split_created',
        title: 'New Split Created! 💰',
        body: `${creatorName} created a new split "${splitData.title}" in ${groupData.name}`,
        data: {
          type: 'split_created',
          groupId: groupData.id,
          splitId: splitData.id,
          groupName: groupData.name,
          splitTitle: splitData.title,
          amount: splitData.amount,
          creatorName,
          url: `trackaexpense://split/group/${
            groupData.id
          }?groupName=${encodeURIComponent(groupData.name)}`,
        },
        icon: '💰',
        priority: 'high',
      });
    } catch (error) {
      console.error('Failed to send split created notification:', error);
    }
  }

  async notifySplitUpdated(
    splitData: Pick<SplitDocument, 'id' | 'title' | 'amount'>,
    groupData: GroupDocument,
    updaterName: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    try {
      const usersToNotify = [...new Set(groupData.members || [])].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'split_updated',
        title: 'Split Updated! ✏️',
        body: `${updaterName} updated the split "${splitData.title}" in ${groupData.name}`,
        data: {
          type: 'split_updated',
          groupId: groupData.id,
          splitId: splitData.id,
          groupName: groupData.name,
          splitTitle: splitData.title,
          amount: splitData.amount,
          updaterName,
          changes,
          url: `trackaexpense://split/group/${
            groupData.id
          }?groupName=${encodeURIComponent(groupData.name)}`,
        },
        icon: '✏️',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to send split updated notification:', error);
    }
  }

  async notifySplitDeleted(
    splitData: Pick<SplitDocument, 'id' | 'title' | 'amount'>,
    groupData: Pick<GroupDocument, 'id' | 'name' | 'members'>,
    deleterName: string,
  ): Promise<void> {
    try {
      const usersToNotify = [...new Set(groupData.members || [])].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'split_deleted',
        title: 'Split Deleted! 🗑️',
        body: `${deleterName} deleted the split "${splitData.title}" from ${groupData.name}`,
        data: {
          type: 'split_deleted',
          groupId: groupData.id,
          splitId: splitData.id,
          groupName: groupData.name,
          splitTitle: splitData.title,
          amount: splitData.amount,
          deleterName,
          url: `trackaexpense://split/group/${
            groupData.id
          }?groupName=${encodeURIComponent(groupData.name)}`,
        },
        icon: '🗑️',
        priority: 'high',
      });
    } catch (error) {
      console.error('Failed to send split deleted notification:', error);
    }
  }

  async notifySplitInvite(
    groupData: GroupDocument & {category?: string},
    inviterName: string,
    inviteeEmail: string,
  ): Promise<void> {
    try {
      await this.notificationService.sendNotificationToUsers([inviteeEmail], {
        type: 'split_invite',
        title: "You're Invited to a Split Group! 🎉",
        body: `${inviterName} invited you to join "${groupData.name}" split group`,
        data: {
          type: 'split_invite',
          groupId: groupData.id,
          groupName: groupData.name,
          groupCategory: groupData.category,
          inviterName,
          inviteeEmail,
          url: 'trackaexpense://split/invitations',
        },
        icon: '🎉',
        priority: 'high',
      });
    } catch (error) {
      console.error('Failed to send split invite notification:', error);
    }
  }

  async notifyUserJoinedGroup(
    groupData: GroupDocument,
    joinerName: string,
  ): Promise<void> {
    try {
      const usersToNotify = [...new Set(groupData.members || [])].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'user_joined_group',
        title: 'New Member Joined! 👋',
        body: `${joinerName} joined "${groupData.name}" split group`,
        data: {
          type: 'user_joined_group',
          groupId: groupData.id,
          groupName: groupData.name,
          joinerName,
          url: `trackaexpense://split/group/${
            groupData.id
          }?groupName=${encodeURIComponent(groupData.name)}`,
        },
        icon: '👋',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to send user joined group notification:', error);
    }
  }

  async notifyUserLeftGroup(
    groupData: GroupDocument,
    leaverName: string,
  ): Promise<void> {
    try {
      const usersToNotify = [...new Set(groupData.members || [])].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'user_left_group',
        title: 'Member Left Group 👋',
        body: `${leaverName} left "${groupData.name}" split group`,
        data: {
          type: 'user_left_group',
          groupId: groupData.id,
          groupName: groupData.name,
          leaverName,
          url: `trackaexpense://split/group/${
            groupData.id
          }?groupName=${encodeURIComponent(groupData.name)}`,
        },
        icon: '👋',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to send user left group notification:', error);
    }
  }

  async notifySettlementMade(
    groupData: GroupDocument,
    settlementData: {id: string; amount: number},
    settlerName: string,
  ): Promise<void> {
    try {
      const usersToNotify = [...new Set(groupData.members || [])].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'settlement_made',
        title: 'Settlement Made! ✅',
        body: `${settlerName} settled up ₹${settlementData.amount} in "${groupData.name}"`,
        data: {
          type: 'settlement_made',
          groupId: groupData.id,
          groupName: groupData.name,
          settlementId: settlementData.id,
          amount: settlementData.amount,
          settlerName,
          url: `trackaexpense://split/group/${
            groupData.id
          }?groupName=${encodeURIComponent(groupData.name)}`,
        },
        icon: '✅',
        priority: 'high',
      });
    } catch (error) {
      console.error('Failed to send settlement notification:', error);
    }
  }

  async notifyGroupCreated(
    groupData: GroupDocument & {pendingInvites?: string[]; category?: string},
    creatorName: string,
  ): Promise<void> {
    try {
      const pendingInvites = groupData.pendingInvites || [];
      if (pendingInvites.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(pendingInvites, {
        type: 'group_created',
        title: 'New Split Group Created! 🎉',
        body: `${creatorName} created "${groupData.name}" split group and invited you`,
        data: {
          type: 'group_created',
          groupId: groupData.id,
          groupName: groupData.name,
          groupCategory: groupData.category,
          creatorName,
          url: 'trackaexpense://split/invitations',
        },
        icon: '🎉',
        priority: 'high',
      });
    } catch (error) {
      console.error('Failed to send group created notification:', error);
    }
  }

  async notifyGroupUpdated(
    groupData: GroupDocument,
    updaterName: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    try {
      const usersToNotify = [...new Set(groupData.members || [])].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'group_updated',
        title: 'Group Updated! ✏️',
        body: `${updaterName} updated "${groupData.name}" split group`,
        data: {
          type: 'group_updated',
          groupId: groupData.id,
          groupName: groupData.name,
          updaterName,
          changes,
          url: `trackaexpense://split/group/${
            groupData.id
          }?groupName=${encodeURIComponent(groupData.name)}`,
        },
        icon: '✏️',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to send group updated notification:', error);
    }
  }

  async notifyGroupDeleted(
    groupData: GroupDocument,
    deleterName: string,
  ): Promise<void> {
    try {
      const usersToNotify = [...new Set(groupData.members || [])].filter(
        email => email !== auth().currentUser?.email,
      );
      if (usersToNotify.length === 0) {
        return;
      }
      await this.notificationService.sendNotificationToUsers(usersToNotify, {
        type: 'group_deleted',
        title: 'Group Deleted! 🗑️',
        body: `${deleterName} deleted "${groupData.name}" split group`,
        data: {
          type: 'group_deleted',
          groupId: groupData.id,
          groupName: groupData.name,
          deleterName,
          url: 'trackaexpense://split',
        },
        icon: '🗑️',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to send group deleted notification:', error);
    }
  }

  async notifyPaymentReminder(
    group: GroupDocument,
    borrower: PersonRef,
    lender: PersonRef,
    amount: number,
  ): Promise<PaymentReminderResult> {
    try {
      const cooldownRef = firestore()
        .collection('groups')
        .doc(group.id)
        .collection('reminders')
        .doc(borrower.email.replace(/[.@]/g, '_'));
      const cooldownDoc = await cooldownRef.get();
      if (cooldownDoc.exists) {
        const lastSent = cooldownDoc.data()?.lastSentAt?.toMillis?.() || 0;
        const hoursSince = (Date.now() - lastSent) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          return {success: false, reason: 'cooldown'};
        }
      }
      await cooldownRef.set({
        lastSentAt: firestore.FieldValue.serverTimestamp(),
      });
      await this.notificationService.sendNotificationToUsers([borrower.email], {
        type: 'payment_reminder',
        title: 'Payment Reminder 💸',
        body: `${lender.name} is reminding you to pay ${amount} for "${group.name}"`,
        data: {
          type: 'payment_reminder',
          groupId: group.id,
          groupName: group.name,
          amount,
          lenderName: lender.name,
          url: `trackaexpense://split/group/${
            group.id
          }?groupName=${encodeURIComponent(group.name)}`,
        },
        icon: '💸',
        priority: 'high',
      });
      return {success: true};
    } catch (error) {
      console.error('Failed to send payment reminder:', error);
      return {success: false, reason: 'error'};
    }
  }
}

export default new SplitNotificationService();
