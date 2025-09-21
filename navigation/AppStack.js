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
import TransactionScreen from '../screens/TransactionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
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
import SettleUpScreen from '../screens/SplitScreens/SettleUpScreen';
import SplitTransactionScreen from '../screens/SplitScreens/SplitTransactionScreen';
import ContactUsScreen from '../screens/ContactUsScreen';
import SavingsScreen from '../screens/SavingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Reusable header styles
const headerStyle = {
  backgroundColor: '#F5F5F5',
  borderBottomWidth: 1,
  borderBottomColor: '#ccc',
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.05,
  shadowRadius: 4,
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
    { name: 'Home', component: HomeScreen, title: 'TrackaExpense' },
    { name: 'Transaction', component: TransactionScreen, title: 'TrackaExpense' },
    { name: 'TransactionDetail', component: TransactionDetailScreen, title: 'TrackaExpense' },
    { name: 'EditTransaction', component: EditTransactionScreen, title: 'TrackaExpense' },
    { name: 'AddIncome', component: AddIncome, title: 'Add Income' },
    { name: 'AddExpense', component: AddExpense, title: 'Add Expense' },
    { name: 'Image', component: ImageScreen, title: '' },
  ]);

// Profile Stack
const ProfileStack = () =>
  createStack([
    { name: 'Profile', component: ProfileScreen, title: 'TrackaExpense' },
    { name: 'EditProfile', component: EditProfileScreen, title: 'TrackaExpense' },
    { name: 'ContactUs', component: ContactUsScreen, title: 'Contact Us' },
    { name: 'PrivacyPolicy', component: PrivacyPolicyScreen, title: 'Privacy Policy' },
  ]);

// Savings Stack
const SavingsStack = () =>
  createStack([
    { name: 'Savings', component: SavingsScreen, title: 'TrackaExpense' },
  ]);

// Statistic Stack
const StatisticStack = () =>
  createStack([
    { name: 'Statistic', component: StatisticScreen, title: 'TrackaExpense' },
    { name: 'TransactionDetail', component: TransactionDetailScreen, title: 'TrackaExpense' },
    { name: 'EditTransaction', component: EditTransactionScreen, title: 'TrackaExpense' },
    { name: 'Image', component: ImageScreen, title: '' },
  ]);

// Transaction Stack
const TransactionStack = () =>
  createStack([
    { name: 'Transaction', component: TransactionScreen, title: 'TrackaExpense' },
    { name: 'TransactionDetail', component: TransactionDetailScreen, title: 'TrackaExpense' },
    { name: 'EditTransaction', component: EditTransactionScreen, title: 'TrackaExpense' },
    { name: 'Image', component: ImageScreen, title: '' },
  ]);


// Split Stack
const SplitStack = () =>
  createStack([
    { name: 'Split', component: SplitScreen, title: 'TrackaExpense' },
    { name: 'SplitGroupDetail', component: SplitGroupDetailScreen, title: 'TrackaExpense' },
    { name: 'CreateSplit', component: CreateSplitScreen, title: 'TrackaExpense' },
    { name: 'SplitDetail', component: SplitDetailScreen, title: 'TrackaExpense' },
    { name: 'SettleUp', component: SettleUpScreen, title: 'TrackaExpense' },
    { name: 'SplitTransaction', component: SplitTransactionScreen, title: 'TrackaExpense' },
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
      name="Transaction"
      component={TransactionStack}
      options={{
        headerShown: false,
        title: 'Transactions',
        tabBarIcon: ({ color, size, focused }) => (
          <MaterialCommunityIcons
            name="format-list-bulleted"
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
      name="Savings"
      component={SavingsStack}
      options={{
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => (
          <MaterialCommunityIcons
            name="piggy-bank"
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
