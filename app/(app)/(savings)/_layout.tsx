import React from 'react';
import {Stack} from 'expo-router/js-stack';
import {useAppStackOptions} from '../../../src/navigation/stackOptions';

export const unstable_settings = {anchor: 'savings'};

const SavingsLayout = () => {
  const options = useAppStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="savings" options={{headerShown: false}} />
      <Stack.Screen
        name="savings/history"
        options={{title: 'Savings History'}}
      />
    </Stack>
  );
};

export default SavingsLayout;
