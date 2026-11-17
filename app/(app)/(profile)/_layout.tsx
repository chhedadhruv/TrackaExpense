import React from 'react';
import {Stack} from 'expo-router/js-stack';
import {useAppStackOptions} from '../../../src/navigation/stackOptions';

export const unstable_settings = {anchor: 'profile'};

const ProfileLayout = () => {
  const options = useAppStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="profile" options={{headerShown: false}} />
      <Stack.Screen name="profile/edit" options={{title: 'Edit Profile'}} />
      <Stack.Screen name="profile/budgets" options={{title: 'Budgets'}} />
      <Stack.Screen name="profile/budget" options={{title: 'Budget'}} />
      <Stack.Screen name="profile/contact" options={{title: 'Contact Us'}} />
      <Stack.Screen
        name="profile/privacy-policy"
        options={{title: 'Privacy Policy'}}
      />
    </Stack>
  );
};

export default ProfileLayout;
