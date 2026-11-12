import React, {useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import {ActivityIndicator} from 'react-native';
import Card from '../../src/components/Card';
import Text from '../../src/components/Text';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import {respondToInvitation} from '../../src/services/InvitationService';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../../src/services/ErrorReporter';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import Check from 'lucide-react-native/icons/check';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {ErrorState} from '../../src/components/ScreenState';
import {useInvitations} from '../../src/data/split';
import type {InvitationDocument} from '../../src/types';
import {snackbar} from '../../src/utils/snackbarStore';

type Invitation = InvitationDocument;

// A stable empty list, so nothing downstream sees a new array on every render before data arrives.
const NO_INVITATIONS: Invitation[] = [];

const InvitationsScreen = () => {
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  // The pending invitations come from the shared cache, kept current by a live listener that the
  // Split screen's badge shares (src/data/split.ts).
  const invitationsData = useInvitations();
  const invitations: Invitation[] = invitationsData.data ?? NO_INVITATIONS;
  const loading = invitationsData.loading;
  // A failed listener must not read as "No invitations yet".
  const failed = invitationsData.error;
  const currentUser = getAuth().currentUser;

  const acceptInvitation = useCallback(
    async (invite: Invitation) => {
      try {
        // The server adds the user to the group and closes the invitation together.
        await respondToInvitation(invite.id, true);
        AnalyticsService.logAcceptInvitation();
        snackbar.success(`You have joined ${invite.groupName}`);
      } catch (e) {
        reportError(e as Error);
        snackbar.error('Failed to accept invitation');
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
        snackbar.error('Failed to decline invitation');
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
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : failed ? (
              <ErrorState
                fill={false}
                title="Could not load invitations"
                onRetry={invitationsData.retry}
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
                          <Users size={22} color={colors.onPrimary} />
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
                          <Check size={18} color={colors.onPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={() => declineInvitation(invite)}>
                          <X size={18} color={colors.expense} />
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
    loader: {marginTop: 20},
    placeholderContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 40,
    },
    listContainer: {width: '100%', paddingHorizontal: 16, marginTop: 12},
    inviteCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 12,
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
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
      backgroundColor: colors.primaryFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteTextContainer: {marginLeft: 12, flex: 1},
    inviteTitle: {fontSize: 16, fontWeight: '600', color: colors.primary},
    inviteSubtitle: {fontSize: 12, color: colors.textSecondary, marginTop: 2},
    inviteActions: {flexDirection: 'row', alignItems: 'center', marginLeft: 8},
    acceptBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryFill,
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 8,
    },
    declineBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.expenseSoft,
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    placeholderTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
    },
    placeholderSubtitle: {fontSize: 14, color: colors.textSecondary},
  });
