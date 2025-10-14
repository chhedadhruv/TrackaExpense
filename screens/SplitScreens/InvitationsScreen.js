import React, {useEffect, useState, useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, Alert} from 'react-native';
import {Text, Card, ActivityIndicator} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const BACKGROUND_COLOR = '#F4F6FA';
const PRIMARY_COLOR = '#677CD2';

const InvitationsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);
  const currentUser = auth().currentUser;

  useEffect(() => {
    if (!currentUser?.email) return;
    const unsub = firestore()
      .collection('invitations')
      .where('email', '==', currentUser.email)
      .where('status', '==', 'pending')
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setInvitations(data);
          setLoading(false);
        },
        () => setLoading(false),
      );
    return () => unsub && unsub();
  }, [currentUser?.email]);

  const acceptInvitation = useCallback(async (invite) => {
    try {
      // Add user to group members and memberNames
      const groupRef = firestore().collection('groups').doc(invite.groupId);
      await firestore().runTransaction(async tx => {
        const groupSnap = await tx.get(groupRef);
        if (!groupSnap.exists) throw new Error('Group not found');
        const group = groupSnap.data();
        const members = Array.isArray(group.members) ? [...group.members] : [];
        const memberNames = group.memberNames || {};
        if (!members.includes(currentUser.email)) {
          members.push(currentUser.email);
        }
        // remove from pendingInvites
        const pendingInvites = (group.pendingInvites || []).filter(e => e !== currentUser.email);
        // fetch name
        let displayName = currentUser.displayName || currentUser.email;
        try {
          const userSnap = await firestore().collection('users').where('email', '==', currentUser.email).get();
          if (!userSnap.empty) {
            const ud = userSnap.docs[0].data();
            displayName = ud.name || ud.displayName || displayName;
          }
        } catch(_) {}
        memberNames[currentUser.email] = displayName;
        tx.update(groupRef, { members, memberNames, pendingInvites, updatedAt: firestore.FieldValue.serverTimestamp() });
      });
      // mark invitation accepted (or delete)
      await firestore().collection('invitations').doc(invite.id).update({ status: 'accepted', respondedAt: firestore.Timestamp.fromDate(new Date()) });
      Alert.alert('Joined', `You have joined ${invite.groupName}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to accept invitation');
    }
  }, [currentUser?.email]);

  const declineInvitation = useCallback(async (invite) => {
    try {
      // remove the invitation or mark declined; also remove from group's pendingInvites
      const groupRef = firestore().collection('groups').doc(invite.groupId);
      await groupRef.update({
        pendingInvites: firestore.FieldValue.arrayRemove(currentUser.email),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      await firestore().collection('invitations').doc(invite.id).update({ status: 'declined', respondedAt: firestore.Timestamp.fromDate(new Date()) });
    } catch (e) {
      Alert.alert('Error', 'Failed to decline invitation');
    }
  }, [currentUser?.email]);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView style={styles.scrollView}>
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Invitations</Text>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={PRIMARY_COLOR} />
            ) : invitations.length === 0 ? (
              <Text style={styles.placeholderSubtitle}>No invitations yet</Text>
            ) : (
              <View style={{ width: '100%', paddingHorizontal: 16, marginTop: 12 }}>
                {invitations.map(invite => (
                  <Card key={invite.id} style={styles.inviteCard} elevation={1}>
                    <View style={styles.inviteRow}>
                      <View style={styles.inviteLeft}>
                        <View style={styles.inviteIconWrap}>
                          <MaterialCommunityIcons name="account-group" size={22} color="#fff" />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={styles.inviteTitle}>{invite.groupName}</Text>
                          <Text style={styles.inviteSubtitle}>Invited by {invite.inviterName || invite.inviterEmail}</Text>
                        </View>
                      </View>
                      <View style={styles.inviteActions}>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptInvitation(invite)}>
                          <MaterialCommunityIcons name="check" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineBtn} onPress={() => declineInvitation(invite)}>
                          <MaterialCommunityIcons name="close" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  inviteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inviteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  inviteSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  acceptBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  declineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});

export default InvitationsScreen;


