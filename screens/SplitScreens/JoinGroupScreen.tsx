import React from 'react';
import {Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {useLocalSearchParams, useRouter} from 'expo-router';
import Users from 'lucide-react-native/icons/users';
import FormButton from '../../components/FormButton';
import {ErrorState, LoadingState} from '../../src/components/ScreenState';
import {useUid} from '../../src/data/hooks';
import {useAsyncAction} from '../../src/hooks/useAsyncAction';
import {reportError} from '../../src/services/ErrorReporter';
import {
  joinGroupByLink,
  previewGroupInviteLink,
} from '../../src/services/InviteLinkService';
import {inviteLinkErrorMessage} from '../../src/utils/inviteLinks';
import {useTheme} from '../../src/theme';
import {snackbar} from '../../src/utils/snackbarStore';
import * as AnalyticsService from '../../src/services/AnalyticsService';

/**
 * Opened from an invite link (`/split/join/<group>/<token>`). Shows the group's name and size and
 * asks before joining: following a link must never add someone to a group on its own.
 */
const JoinGroupScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const uid = useUid();
  const {groupId, token} = useLocalSearchParams<{
    groupId: string;
    token: string;
  }>();
  const ready = typeof groupId === 'string' && typeof token === 'string';

  const preview = useQuery({
    queryKey: ['invitePreview', uid, groupId, token],
    enabled: ready && uid !== '',
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => previewGroupInviteLink(groupId, token),
  });

  const openGroup = () =>
    router.replace({
      pathname: '/split/group/[groupId]',
      params: {groupId},
    });

  const join = async () => {
    try {
      const result = await joinGroupByLink(groupId, token);
      if (result.status === 'joined') {
        AnalyticsService.logInviteLinkJoined();
      }
      snackbar.success(
        result.status === 'joined'
          ? `You joined ${preview.data?.groupName ?? 'the group'}`
          : 'You are already in this group',
      );
      openGroup();
    } catch (error) {
      reportError(error as Error);
      snackbar.error(inviteLinkErrorMessage(error));
    }
  };
  const {run: handleJoin, pending: joining} = useAsyncAction(join);

  if (!ready) {
    return (
      <ErrorState
        title="This invite link is not valid"
        message="Ask the person who shared it for a new link."
        onRetry={() => router.replace('/split')}
        fill
      />
    );
  }
  if (preview.isPending) {
    return <LoadingState message="Checking the invite..." />;
  }
  if (preview.isError || !preview.data) {
    return (
      <ErrorState
        title="Could not open this invite"
        message={inviteLinkErrorMessage(preview.error)}
        onRetry={() => {
          preview.refetch();
        }}
      />
    );
  }

  const {groupName, memberCount, alreadyMember} = preview.data;
  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
        <Users size={40} color={colors.primary} />
      </View>
      <Text
        accessibilityRole="header"
        className="mb-2 text-center font-heading text-[28px] font-bold text-text-strong">
        {alreadyMember ? `You are in ${groupName}` : `Join ${groupName}?`}
      </Text>
      <Text className="mb-8 text-center font-sans text-base text-text-secondary">
        {alreadyMember
          ? 'You are already a member of this group.'
          : `${memberCount} ${
              memberCount === 1 ? 'person is' : 'people are'
            } in this group. Joining lets you see and add shared expenses.`}
      </Text>
      <View className="w-full">
        {alreadyMember ? (
          <FormButton buttonTitle="Open group" onPress={openGroup} />
        ) : (
          <>
            <FormButton
              buttonTitle="Join group"
              onPress={handleJoin}
              loading={joining}
            />
            <FormButton
              buttonTitle="Not now"
              onPress={() => router.replace('/split')}
              disabled={joining}
              style={{backgroundColor: colors.textMuted}}
            />
          </>
        )}
      </View>
    </View>
  );
};

export default JoinGroupScreen;
