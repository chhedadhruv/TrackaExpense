import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NotificationService from './NotificationService';

class SplitNotificationService {
  constructor() {
    this.notificationService = NotificationService;
  }

  // Send notification when a split is created
  async notifySplitCreated(splitData, groupData, creatorName) {
    try {
      const groupMembers = groupData.members || [];
      const pendingInvites = groupData.pendingInvites || [];
      
      // Get all users who should be notified (members + pending invites)
      const allUsers = [...groupMembers, ...pendingInvites];
      
      // Remove the creator from the notification list and deduplicate
      const usersToNotify = [...new Set(allUsers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
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
          creatorName: creatorName,
        },
        icon: '💰',
        priority: 'high',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send split created notification:', error);
    }
  }

  // Send notification when a split is updated
  async notifySplitUpdated(splitData, groupData, updaterName, changes) {
    try {
      const groupMembers = groupData.members || [];
      const usersToNotify = [...new Set(groupMembers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
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
          updaterName: updaterName,
          changes: changes,
        },
        icon: '✏️',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send split updated notification:', error);
    }
  }

  // Send notification when a split is deleted
  async notifySplitDeleted(splitData, groupData, deleterName) {
    try {
      const groupMembers = groupData.members || [];
      const usersToNotify = [...new Set(groupMembers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
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
          deleterName: deleterName,
        },
        icon: '🗑️',
        priority: 'high',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send split deleted notification:', error);
    }
  }

  // Send notification when someone is invited to a split group
  async notifySplitInvite(groupData, inviterName, inviteeEmail) {
    try {
      const notificationData = {
        type: 'split_invite',
        title: 'You\'re Invited to a Split Group! 🎉',
        body: `${inviterName} invited you to join "${groupData.name}" split group`,
        data: {
          type: 'split_invite',
          groupId: groupData.id,
          groupName: groupData.name,
          groupCategory: groupData.category,
          inviterName: inviterName,
          inviteeEmail: inviteeEmail,
        },
        icon: '🎉',
        priority: 'high',
      };

      await this.notificationService.sendNotificationToUsers([inviteeEmail], notificationData);
    } catch (error) {
      console.error('Failed to send split invite notification:', error);
    }
  }

  // Send notification when someone joins a split group
  async notifyUserJoinedGroup(groupData, joinerName) {
    try {
      const groupMembers = groupData.members || [];
      const usersToNotify = [...new Set(groupMembers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
        type: 'user_joined_group',
        title: 'New Member Joined! 👋',
        body: `${joinerName} joined "${groupData.name}" split group`,
        data: {
          type: 'user_joined_group',
          groupId: groupData.id,
          groupName: groupData.name,
          joinerName: joinerName,
        },
        icon: '👋',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send user joined group notification:', error);
    }
  }

  // Send notification when someone leaves a split group
  async notifyUserLeftGroup(groupData, leaverName) {
    try {
      const groupMembers = groupData.members || [];
      const usersToNotify = [...new Set(groupMembers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
        type: 'user_left_group',
        title: 'Member Left Group 👋',
        body: `${leaverName} left "${groupData.name}" split group`,
        data: {
          type: 'user_left_group',
          groupId: groupData.id,
          groupName: groupData.name,
          leaverName: leaverName,
        },
        icon: '👋',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send user left group notification:', error);
    }
  }

  // Send notification when a settlement is made
  async notifySettlementMade(groupData, settlementData, settlerName) {
    try {
      const groupMembers = groupData.members || [];
      const usersToNotify = [...new Set(groupMembers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
        type: 'settlement_made',
        title: 'Settlement Made! ✅',
        body: `${settlerName} settled up ₹${settlementData.amount} in "${groupData.name}"`,
        data: {
          type: 'settlement_made',
          groupId: groupData.id,
          groupName: groupData.name,
          settlementId: settlementData.id,
          amount: settlementData.amount,
          settlerName: settlerName,
        },
        icon: '✅',
        priority: 'high',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send settlement notification:', error);
    }
  }

  // Send notification when a group is created
  async notifyGroupCreated(groupData, creatorName) {
    try {
      const pendingInvites = groupData.pendingInvites || [];
      
      if (pendingInvites.length === 0) return;

      const notificationData = {
        type: 'group_created',
        title: 'New Split Group Created! 🎉',
        body: `${creatorName} created "${groupData.name}" split group and invited you`,
        data: {
          type: 'group_created',
          groupId: groupData.id,
          groupName: groupData.name,
          groupCategory: groupData.category,
          creatorName: creatorName,
        },
        icon: '🎉',
        priority: 'high',
      };

      await this.notificationService.sendNotificationToUsers(pendingInvites, notificationData);
    } catch (error) {
      console.error('Failed to send group created notification:', error);
    }
  }

  // Send notification when a group is updated
  async notifyGroupUpdated(groupData, updaterName, changes) {
    try {
      const groupMembers = groupData.members || [];
      const usersToNotify = [...new Set(groupMembers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
        type: 'group_updated',
        title: 'Group Updated! ✏️',
        body: `${updaterName} updated "${groupData.name}" split group`,
        data: {
          type: 'group_updated',
          groupId: groupData.id,
          groupName: groupData.name,
          updaterName: updaterName,
          changes: changes,
        },
        icon: '✏️',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send group updated notification:', error);
    }
  }

  // Send notification when a group is deleted
  async notifyGroupDeleted(groupData, deleterName) {
    try {
      const groupMembers = groupData.members || [];
      const usersToNotify = [...new Set(groupMembers)].filter(email => email !== auth().currentUser?.email);

      if (usersToNotify.length === 0) return;

      const notificationData = {
        type: 'group_deleted',
        title: 'Group Deleted! 🗑️',
        body: `${deleterName} deleted "${groupData.name}" split group`,
        data: {
          type: 'group_deleted',
          groupId: groupData.id,
          groupName: groupData.name,
          deleterName: deleterName,
        },
        icon: '🗑️',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers(usersToNotify, notificationData);
    } catch (error) {
      console.error('Failed to send group deleted notification:', error);
    }
  }

  async notifyPaymentReminder(group, borrower, lender, amount) {
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
          return { success: false, reason: 'cooldown' };
        }
      }
      await cooldownRef.set({ lastSentAt: firestore.FieldValue.serverTimestamp() });
      const notificationData = {
        type: 'payment_reminder',
        title: 'Payment Reminder 💸',
        body: `${lender.name} is reminding you to pay ${amount} for "${group.name}"`,
        data: {
          type: 'payment_reminder',
          groupId: group.id,
          groupName: group.name,
          amount: amount,
          lenderName: lender.name,
        },
        icon: '💸',
        priority: 'high',
      };
      await this.notificationService.sendNotificationToUsers([borrower.email], notificationData);
      return { success: true };
    } catch (error) {
      console.error('Failed to send payment reminder:', error);
      return { success: false, reason: 'error' };
    }
  }
}

export default new SplitNotificationService();
