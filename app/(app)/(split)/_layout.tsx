import React from 'react';
import {Stack} from 'expo-router/js-stack';
import {useAppStackOptions} from '../../../src/navigation/stackOptions';

// A link straight into this tab (for example /split/group/abc) still has the Split list underneath.
export const unstable_settings = {anchor: 'split'};

const SplitLayout = () => {
  const options = useAppStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="split" options={{headerShown: false}} />
      <Stack.Screen
        name="split/group/[groupId]/index"
        options={{title: 'Group Details'}}
      />
      <Stack.Screen
        name="split/group/[groupId]/create"
        options={{title: 'Create Split'}}
      />
      <Stack.Screen
        name="split/group/[groupId]/split/[splitId]"
        options={{title: 'Split Details'}}
      />
      <Stack.Screen
        name="split/group/[groupId]/settle"
        options={{title: 'Settle Up'}}
      />
      <Stack.Screen
        name="split/group/[groupId]/transactions"
        options={{title: 'Transactions'}}
      />
      <Stack.Screen name="split/history" options={{title: 'Split History'}} />
      <Stack.Screen name="split/invitations" options={{title: 'Invitations'}} />
      <Stack.Screen
        name="split/friends"
        options={{title: 'Friends & Balances'}}
      />
      <Stack.Screen name="split/iou/index" options={{title: 'IOUs'}} />
      <Stack.Screen name="split/iou/new" options={{title: 'New IOU'}} />
    </Stack>
  );
};

export default SplitLayout;
