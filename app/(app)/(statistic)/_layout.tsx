import React from 'react';
import {Stack} from 'expo-router/js-stack';
import {useAppStackOptions} from '../../../src/navigation/stackOptions';

export const unstable_settings = {anchor: 'statistic'};

const StatisticLayout = () => {
  const options = useAppStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="statistic" options={{headerShown: false}} />
      <Stack.Screen
        name="statistic/transaction/[id]/index"
        options={{title: 'Transaction Details'}}
      />
      <Stack.Screen
        name="statistic/transaction/[id]/edit"
        options={{title: 'Edit Transaction'}}
      />
      <Stack.Screen name="statistic/image" options={{title: ''}} />
    </Stack>
  );
};

export default StatisticLayout;
