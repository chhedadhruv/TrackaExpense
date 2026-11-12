import React from 'react';
import {Stack} from 'expo-router/js-stack';
import {useAppStackOptions} from '../../../src/navigation/stackOptions';

// A link straight into this tab (for example /income/add) still has Home underneath it.
export const unstable_settings = {anchor: 'home'};

const HomeLayout = () => {
  const options = useAppStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="home" options={{headerShown: false}} />
      <Stack.Screen name="transactions" options={{title: 'Transactions'}} />
      <Stack.Screen
        name="transaction/[id]/index"
        options={{title: 'Transaction Details'}}
      />
      <Stack.Screen
        name="transaction/[id]/edit"
        options={{title: 'Edit Transaction'}}
      />
      <Stack.Screen name="income/add" options={{title: 'Add Income'}} />
      <Stack.Screen name="expense/add" options={{title: 'Add Expense'}} />
      <Stack.Screen name="image" options={{title: ''}} />
    </Stack>
  );
};

export default HomeLayout;
