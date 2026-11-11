import React, {useMemo} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import FeatherIcons from '@expo/vector-icons/Feather';
import {View} from 'react-native';
import {setSnackbarBottomOffset} from '../src/utils/snackbarStore';

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
import {useTheme} from '../src/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

interface ScreenConfig {
  name: string;
  component: React.ComponentType<any>;
  title: string;
  headerShown?: boolean;
}

const ThemedStack = ({screens}: {screens: ScreenConfig[]}) => {
  const {colors} = useTheme();
  const headerStyle = useMemo(
    () => ({
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      elevation: 2,
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.05,
      shadowRadius: 4,
    }),
    [colors],
  );
  const headerTitleStyle = useMemo(
    () => ({
      fontFamily: 'Kufam-SemiBoldItalic',
      fontSize: 18,
      color: colors.text,
    }),
    [colors],
  );
  return (
    <Stack.Navigator>
      {screens.map(({name, component, title, headerShown = true}) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          options={
            {
              headerShown,
              // App.tsx already pads the top safe area; without this the stack header adds the
              // status bar height a second time and the header is about twice as tall.
              headerStatusBarHeight: 0,
              headerTitle: title,
              headerTitleAlign: 'center',
              headerStyle,
              headerTitleStyle,
            } as any
          }
        />
      ))}
    </Stack.Navigator>
  );
};

const HomeStack = () => (
  <ThemedStack
    screens={[
      {name: 'Home', component: HomeScreen, title: 'Home', headerShown: false},
      {
        name: 'Transaction',
        component: TransactionScreen,
        title: 'Transactions',
      },
      {
        name: 'TransactionDetail',
        component: TransactionDetailScreen,
        title: 'Transaction Details',
      },
      {
        name: 'EditTransaction',
        component: EditTransactionScreen,
        title: 'Edit Transaction',
      },
      {name: 'AddIncome', component: AddIncome, title: 'Add Income'},
      {name: 'AddExpense', component: AddExpense, title: 'Add Expense'},
      {name: 'Image', component: ImageScreen, title: ''},
    ]}
  />
);

const ProfileStack = () => (
  <ThemedStack
    screens={[
      {
        name: 'Profile',
        component: ProfileScreen,
        title: 'Profile',
        headerShown: false,
      },
      {
        name: 'EditProfile',
        component: EditProfileScreen,
        title: 'Edit Profile',
      },
      {name: 'ContactUs', component: ContactUsScreen, title: 'Contact Us'},
      {
        name: 'PrivacyPolicy',
        component: PrivacyPolicyScreen,
        title: 'Privacy Policy',
      },
    ]}
  />
);

const SavingsStack = () => (
  <ThemedStack
    screens={[
      {
        name: 'Savings',
        component: SavingsScreen,
        title: 'Savings',
        headerShown: false,
      },
      {
        name: 'SavingsHistory',
        component: SavingsHistoryScreen,
        title: 'Savings History',
      },
    ]}
  />
);

const StatisticStack = () => (
  <ThemedStack
    screens={[
      {
        name: 'Statistic',
        component: StatisticScreen,
        title: 'Statistics',
        headerShown: false,
      },
      {
        name: 'TransactionDetail',
        component: TransactionDetailScreen,
        title: 'Transaction Details',
      },
      {
        name: 'EditTransaction',
        component: EditTransactionScreen,
        title: 'Edit Transaction',
      },
      {name: 'Image', component: ImageScreen, title: ''},
    ]}
  />
);

const SplitStack = () => (
  <ThemedStack
    screens={[
      {
        name: 'Split',
        component: SplitScreen,
        title: 'Split Bills',
        headerShown: false,
      },
      {
        name: 'SplitGroupDetail',
        component: SplitGroupDetailScreen,
        title: 'Group Details',
      },
      {
        name: 'CreateSplit',
        component: CreateSplitScreen,
        title: 'Create Split',
      },
      {
        name: 'SplitDetail',
        component: SplitDetailScreen,
        title: 'Split Details',
      },
      {name: 'SettleUp', component: SettleUpScreen, title: 'Settle Up'},
      {
        name: 'SplitTransaction',
        component: SplitTransactionScreen,
        title: 'Transactions',
      },
      {
        name: 'SplitHistory',
        component: SplitHistoryScreen,
        title: 'Split History',
      },
      {name: 'Invitations', component: InvitationsScreen, title: 'Invitations'},
      {
        name: 'FriendsBalance',
        component: FriendsBalanceScreen,
        title: 'Friends & Balances',
      },
      {name: 'IOU', component: IOUScreen, title: 'IOUs'},
      {name: 'CreateIOU', component: CreateIOUScreen, title: 'New IOU'},
    ]}
  />
);

// Reports the tab bar height so the snackbar floats just above it.
const MeasuredTabBar = (props: BottomTabBarProps) => {
  React.useEffect(() => () => setSnackbarBottomOffset(0), []);
  return (
    <View
      onLayout={event =>
        setSnackbarBottomOffset(event.nativeEvent.layout.height)
      }>
      <BottomTabBar {...props} />
    </View>
  );
};

const renderTabBar = (props: BottomTabBarProps) => (
  <MeasuredTabBar {...props} />
);

const AppStack = () => {
  const {colors} = useTheme();
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{activeTintColor: colors.primary} as any}>
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          headerShown: false,
          tabBarIcon: ({color, size, focused}) => (
            <MaterialCommunityIcons
              name="home"
              color={focused ? colors.primary : color}
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
          tabBarIcon: ({color, size, focused}) => (
            <FeatherIcons
              name="bar-chart-2"
              color={focused ? colors.primary : color}
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
          tabBarIcon: ({color, size, focused}) => (
            <FontAwesome6
              name="money-bill-transfer"
              color={focused ? colors.primary : color}
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
              color={focused ? colors.primary : color}
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
            <Ionicons
              name="person-outline"
              color={focused ? colors.primary : color}
              size={size}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default AppStack;
