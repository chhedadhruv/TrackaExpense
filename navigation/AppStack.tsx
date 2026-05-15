import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import FeatherIcons from 'react-native-vector-icons/Feather';

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
import SplitHistoryScreen from '../screens/SplitScreens/SplitHistoryScreen';
import InvitationsScreen from '../screens/SplitScreens/InvitationsScreen';
import FriendsBalanceScreen from '../screens/SplitScreens/FriendsBalanceScreen';
import IOUScreen from '../screens/SplitScreens/IOUScreen';
import CreateIOUScreen from '../screens/SplitScreens/CreateIOUScreen';
import ContactUsScreen from '../screens/ContactUsScreen';
import SavingsScreen from '../screens/SavingsScreen';
import SavingsHistoryScreen from '../screens/SavingsHistoryScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import {PRIMARY_COLOR} from '../src/constants/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const headerStyle = {
  backgroundColor: '#F5F5F5',
  borderBottomWidth: 1,
  borderBottomColor: '#ccc',
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: {width: 0, height: 2},
  shadowOpacity: 0.05,
  shadowRadius: 4,
};

const headerTitleStyle = {
  fontFamily: 'Kufam-SemiBoldItalic',
  fontSize: 18,
  color: '#333',
};

interface ScreenConfig {
  name: string;
  component: React.ComponentType<any>;
  title: string;
}

const createStack = (screens: ScreenConfig[]) => (
  <Stack.Navigator>
    {screens.map(({name, component, title}) => (
      <Stack.Screen
        key={name}
        name={name}
        component={component}
        options={{
          headerShown: true,
          headerTitle: title,
          headerTitleAlign: 'center',
          headerStyle,
          headerTitleStyle,
        } as any}
      />
    ))}
  </Stack.Navigator>
);

const HomeStack = () =>
  createStack([
    {name: 'Home', component: HomeScreen, title: 'Home'},
    {name: 'Transaction', component: TransactionScreen, title: 'Transactions'},
    {name: 'TransactionDetail', component: TransactionDetailScreen, title: 'Transaction Details'},
    {name: 'EditTransaction', component: EditTransactionScreen, title: 'Edit Transaction'},
    {name: 'AddIncome', component: AddIncome, title: 'Add Income'},
    {name: 'AddExpense', component: AddExpense, title: 'Add Expense'},
    {name: 'Image', component: ImageScreen, title: ''},
  ]);

const ProfileStack = () =>
  createStack([
    {name: 'Profile', component: ProfileScreen, title: 'Profile'},
    {name: 'EditProfile', component: EditProfileScreen, title: 'Edit Profile'},
    {name: 'ContactUs', component: ContactUsScreen, title: 'Contact Us'},
    {name: 'PrivacyPolicy', component: PrivacyPolicyScreen, title: 'Privacy Policy'},
  ]);

const SavingsStack = () =>
  createStack([
    {name: 'Savings', component: SavingsScreen, title: 'Savings'},
    {name: 'SavingsHistory', component: SavingsHistoryScreen, title: 'Savings History'},
  ]);

const StatisticStack = () =>
  createStack([
    {name: 'Statistic', component: StatisticScreen, title: 'Statistics'},
    {name: 'TransactionDetail', component: TransactionDetailScreen, title: 'Transaction Details'},
    {name: 'EditTransaction', component: EditTransactionScreen, title: 'Edit Transaction'},
    {name: 'Image', component: ImageScreen, title: ''},
  ]);

const SplitStack = () =>
  createStack([
    {name: 'Split', component: SplitScreen, title: 'Split Bills'},
    {name: 'SplitGroupDetail', component: SplitGroupDetailScreen, title: 'Group Details'},
    {name: 'CreateSplit', component: CreateSplitScreen, title: 'Create Split'},
    {name: 'SplitDetail', component: SplitDetailScreen, title: 'Split Details'},
    {name: 'SettleUp', component: SettleUpScreen, title: 'Settle Up'},
    {name: 'SplitTransaction', component: SplitTransactionScreen, title: 'Transactions'},
    {name: 'SplitHistory', component: SplitHistoryScreen, title: 'Split History'},
    {name: 'Invitations', component: InvitationsScreen, title: 'Invitations'},
    {name: 'FriendsBalance', component: FriendsBalanceScreen, title: 'Friends & Balances'},
    {name: 'IOU', component: IOUScreen, title: 'IOUs'},
    {name: 'CreateIOU', component: CreateIOUScreen, title: 'New IOU'},
  ]);

const AppStack = () => (
  <Tab.Navigator screenOptions={{activeTintColor: '#2e64e5'} as any}>
    <Tab.Screen
      name="Home"
      component={HomeStack}
      options={{
        headerShown: false,
        tabBarIcon: ({color, size, focused}) => (
          <MaterialCommunityIcons name="home" color={focused ? PRIMARY_COLOR : color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="Statistic"
      component={StatisticStack}
      options={{
        headerShown: false,
        tabBarIcon: ({color, size, focused}) => (
          <FeatherIcons name="bar-chart-2" color={focused ? PRIMARY_COLOR : color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="Split"
      component={SplitStack}
      options={{
        headerShown: false,
        tabBarIcon: ({color, size, focused}) => (
          <FontAwesome6
            name="money-bill-transfer"
            color={focused ? PRIMARY_COLOR : color}
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
        tabBarIcon: ({color, size, focused}) => (
          <MaterialCommunityIcons
            name="piggy-bank"
            color={focused ? PRIMARY_COLOR : color}
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
        tabBarIcon: ({color, size, focused}) => (
          <Ionicons name="person-outline" color={focused ? PRIMARY_COLOR : color} size={size} />
        ),
      }}
    />
  </Tab.Navigator>
);

export default AppStack;
