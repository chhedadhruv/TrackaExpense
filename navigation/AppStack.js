import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import FeatherIcons from 'react-native-vector-icons/Feather';

// Screens
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SavingScreen from '../screens/SavingScreen';
import EditSavingScreen from '../screens/EditSavingScreen';
import AddOrRemoveExpense from '../screens/AddOrRemoveExpense';
import StatisticScreen from '../screens/StatisticScreen';
import AddIncome from '../screens/AddIncome';
import AddExpense from '../screens/AddExpense';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import EditTransactionScreen from '../screens/EditTransactionScreen';
import ImageScreen from '../screens/ImageScreen';
import SplitScreen from '../screens/SplitScreens/SplitScreen';
import SplitGroupDetailScreen from '../screens/SplitScreens/SplitGroupDetailScreen';
import CreateSplitScreen from '../screens/SplitScreens/CreateSplitScreen';
import SplitDetailScreen from '../screens/SplitScreens/SplitDetailScreen';
import FeedbackScreen from '../screens/FeedbackScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Reusable header styles
const headerStyle = {
  backgroundColor: '#F5F5F5',
  elevation: 0,
};
const headerTitleStyle = {
  fontFamily: 'Kufam-SemiBoldItalic',
  fontSize: 18,
  color: '#333',
};

// Helper function for stack screens
const createStack = (screens) => (
  <Stack.Navigator>
    {screens.map(({ name, component, title }) => (
      <Stack.Screen
        key={name}
        name={name}
        component={component}
        options={{
          headerShown: true,
          headerTitle: title,
          headerBackTitleVisible: false,
          headerTitleAlign: 'center',
          headerStyle,
          headerTitleStyle,
        }}
      />
    ))}
  </Stack.Navigator>
);

// Home Stack
const HomeStack = () =>
  createStack([
    { name: 'Home', component: HomeScreen, title: 'Tracka Expense' },
    { name: 'Saving', component: SavingScreen, title: 'Your Savings' },
    { name: 'TransactionDetail', component: TransactionDetailScreen, title: 'Transaction Detail' },
    { name: 'EditTransaction', component: EditTransactionScreen, title: 'Edit Transaction' },
    { name: 'Image', component: ImageScreen, title: '' },
  ]);

// Profile Stack
const ProfileStack = () =>
  createStack([
    { name: 'Profile', component: ProfileScreen, title: 'Profile' },
    { name: 'EditProfile', component: EditProfileScreen, title: 'Edit Profile' },
    { name: 'Feedback', component: FeedbackScreen, title: 'Feedback' },
  ]);

// Statistic Stack
const StatisticStack = () =>
  createStack([
    { name: 'Statistic', component: StatisticScreen, title: 'Statistic' },
    { name: 'TransactionDetail', component: TransactionDetailScreen, title: 'Transaction Detail' },
    { name: 'EditTransaction', component: EditTransactionScreen, title: 'Edit Transaction' },
    { name: 'Image', component: ImageScreen, title: '' },
  ]);

// Expense Stack
const AddOrRemoveExpenseStack = () =>
  createStack([
    { name: 'AddOrRemoveExpense', component: AddOrRemoveExpense, title: 'Handle Transaction' },
    { name: 'AddIncome', component: AddIncome, title: 'Add Income' },
    { name: 'AddExpense', component: AddExpense, title: 'Add Expense' },
    { name: 'TransactionDetail', component: TransactionDetailScreen, title: 'Transaction Detail' },
    { name: 'EditTransaction', component: EditTransactionScreen, title: 'Edit Transaction' },
    { name: 'Image', component: ImageScreen, title: '' },
  ]);

// Split Stack
const SplitStack = () =>
  createStack([
    { name: 'Split', component: SplitScreen, title: 'Split' },
    { name: 'SplitGroupDetail', component: SplitGroupDetailScreen, title: 'Split Group Detail' },
    { name: 'CreateSplit', component: CreateSplitScreen, title: 'Create Split' },
    { name: 'SplitDetail', component: SplitDetailScreen, title: 'Split Detail' },
  ]);

  const SavingStack = () =>
  createStack([
    { name: 'Saving', component: SavingScreen, title: 'Your Savings' },
    { name: 'EditSaving', component: EditSavingScreen, title: 'Edit Saving Goal' },
  ]);

const AppStack = () => (
  <Tab.Navigator screenOptions={{ activeTintColor: '#2e64e5' }}>
    <Tab.Screen
      name="Home"
      component={HomeStack}
      options={{
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <MaterialCommunityIcons
            name="home"
            color={focused ? '#677CD2' : color}
            size={size}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Statistic"
      component={StatisticStack}
      options={{
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <FeatherIcons
            name="bar-chart-2"
            color={focused ? '#677CD2' : color}
            size={size}
          />
        ),
      }}
    />
    <Tab.Screen
      name="AddOrRemoveExpense"
      component={AddOrRemoveExpenseStack}
      options={{
        headerShown: false,
        title: 'Add',
        tabBarIcon: ({ color, size, focused }) => (
          <FontAwesome5
            name="plus-circle"
            color={focused ? '#677CD2' : color}
            size={size}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Saving"
      component={SavingStack}
      options={{
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <MaterialCommunityIcons
            name="bank"
            color={focused ? '#677CD2' : color}
            size={size}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Split"
      component={SplitStack}
      options={{
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <FontAwesome6
            name="money-bill-transfer"
            color={focused ? '#677CD2' : color}
            size={size}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileStack}
      options={{
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name="person-outline"
            color={focused ? '#677CD2' : color}
            size={size}
          />
        ),
      }}
    />
  </Tab.Navigator>
);

export default AppStack;
