import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {Text, Card, ActivityIndicator} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import {respondToInvitation} from '../../src/services/InvitationService';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../../src/services/ErrorReporter';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../../src/constants/theme';

interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  inviterName?: string;
  inviterEmail?: string;
  email: string;
  status: string;
}

const InvitationsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const currentUser = getAuth().currentUser;

  useEffect(() => {
    if (!currentUser?.email) {
      return;
    }
    const unsub = onSnapshot(
      query(
        collection(getFirestore(), 'invitations'),
        where('email', '==', currentUser.email),
        where('status', '==', 'pending'),
      ),
      snapshot => {
        const data = snapshot.docs.map(
          d => ({id: d.id, ...d.data()} as Invitation),
        );
        setInvitations(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub && unsub();
  }, [currentUser?.email]);

  const acceptInvitation = useCallback(
    async (invite: Invitation) => {
      try {
        // The server adds the user to the group and closes the invitation together.
        await respondToInvitation(invite.id, true);
        AnalyticsService.logAcceptInvitation();
        Alert.alert('Joined', `You have joined ${invite.groupName}`);
      } catch (e) {
        reportError(e as Error);
        Alert.alert('Error', 'Failed to accept invitation');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.email],
  );

  const declineInvitation = useCallback(
    async (invite: Invitation) => {
      try {
        await respondToInvitation(invite.id, false);
        AnalyticsService.logDeclineInvitation();
      } catch (e) {
        reportError(e as Error);
        Alert.alert('Error', 'Failed to decline invitation');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.email],
  );

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView style={styles.scrollView}>
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Invitations</Text>
            {loading ? (
              <ActivityIndicator
                style={{marginTop: 20}}
                color={PRIMARY_COLOR}
              />
            ) : invitations.length === 0 ? (
              <Text style={styles.placeholderSubtitle}>No invitations yet</Text>
            ) : (
              <View style={styles.listContainer}>
                {invitations.map(invite => (
                  <Card
                    key={invite.id}
                    style={[
                      styles.inviteCard,
                      Platform.OS === 'android' && styles.cardAndroid,
                    ]}
                    elevation={Platform.OS === 'android' ? 0 : 1}>
                    <View style={styles.inviteRow}>
                      <View style={styles.inviteLeft}>
                        <View style={styles.inviteIconWrap}>
                          <MaterialCommunityIcons
                            name="account-group"
                            size={22}
                            color="#fff"
                          />
                        </View>
                        <View style={styles.inviteTextContainer}>
                          <Text style={styles.inviteTitle}>
                            {invite.groupName}
                          </Text>
                          <Text style={styles.inviteSubtitle}>
                            Invited by{' '}
                            {invite.inviterName || invite.inviterEmail}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.inviteActions}>
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => acceptInvitation(invite)}>
                          <MaterialCommunityIcons
                            name="check"
                            size={18}
                            color="#fff"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={() => declineInvitation(invite)}>
                          <MaterialCommunityIcons
                            name="close"
                            size={18}
                            color="#FF3B30"
                          />
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

export default InvitationsScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  listContainer: {width: '100%', paddingHorizontal: 16, marginTop: 12},
  inviteCard: {backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  inviteLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  inviteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTextContainer: {marginLeft: 12, flex: 1},
  inviteTitle: {fontSize: 16, fontWeight: '600', color: PRIMARY_COLOR},
  inviteSubtitle: {fontSize: 12, color: '#666', marginTop: 2},
  inviteActions: {flexDirection: 'row', alignItems: 'center', marginLeft: 8},
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
  placeholderSubtitle: {fontSize: 14, color: '#666'},
});
