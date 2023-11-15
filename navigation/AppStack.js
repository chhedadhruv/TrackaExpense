import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FeatherIcons from 'react-native-vector-icons/Feather';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SavingScreen from '../screens/SavingScreen';
import AddOrRemoveExpense from '../screens/AddOrRemoveExpense';
import StatisticScreen from '../screens/StatisticScreen';
import AddIncome from '../screens/AddIncome';
import AddExpense from '../screens/AddExpense';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import ImageScreen from '../screens/ImageScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const HomeStack = ({navigation}) => (
  <Stack.Navigator>
    <Stack.Screen
      name="Tracka Expense"
      component={HomeScreen}
      options={({route, navigation}) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: '#F5F5F5', // Light gray background (a shade of white)
          elevation: 0, // Remove shadow on Android
        },
        headerTintColor: '#333', // Dark gray text color (a shade of black)
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: 'Kufam-SemiBoldItalic',
          fontSize: 18,
          color: '#333', // Dark gray title color (a shade of black)
        },
      })}
    />
    <Stack.Screen
      name="TransactionDetail"
      component={TransactionDetailScreen}
      options={{
        headerTitle: 'Transaction Detail',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
    <Stack.Screen
      name="Image"
      component={ImageScreen}
      options={{
        headerTitle: '',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
  </Stack.Navigator>
);

const ProfileStack = ({navigation}) => (
  <Stack.Navigator>
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#F5F5F5', // Light gray background (a shade of white)
          elevation: 0, // Remove shadow on Android
        },
        headerTintColor: '#333', // Dark gray text color (a shade of black)
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: 'Kufam-SemiBoldItalic',
          fontSize: 18,
          color: '#333', // Dark gray title color (a shade of black)
        },
      }}
    />
    <Stack.Screen
      name="EditProfile"
      component={EditProfileScreen}
      options={{
        headerTitle: 'Edit Profile',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
  </Stack.Navigator>
);

const SavingStack = ({navigation}) => (
  <Stack.Navigator>
    <Stack.Screen
      name="Saving"
      component={SavingScreen}
      options={{
        headerShown: true,
        title: 'Your Savings',
        headerStyle: {
          backgroundColor: '#F5F5F5', // Light gray background (a shade of white)
          elevation: 0, // Remove shadow on Android
        },
        headerTintColor: '#333', // Dark gray text color (a shade of black)
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: 'Kufam-SemiBoldItalic',
          fontSize: 18,
          color: '#333', // Dark gray title color (a shade of black)
        },
      }}
    />
  </Stack.Navigator>
);

const StatisticStack = ({navigation}) => (
  <Stack.Navigator>
    <Stack.Screen
      name="Statistic"
      component={StatisticScreen}
      options={{
        headerShown: true,
        title: 'Statistic',
        headerStyle: {
          backgroundColor: '#F5F5F5', // Light gray background (a shade of white)
          elevation: 0, // Remove shadow on Android
        },
        headerTintColor: '#333', // Dark gray text color (a shade of black)
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: 'Kufam-SemiBoldItalic',
          fontSize: 18,
          color: '#333', // Dark gray title color (a shade of black)
        },
      }}
    />
    <Stack.Screen
      name="TransactionDetail"
      component={TransactionDetailScreen}
      options={{
        headerTitle: 'Transaction Detail',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
    <Stack.Screen
      name="Image"
      component={ImageScreen}
      options={{
        headerTitle: '',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
  </Stack.Navigator>
);

const AddOrRemoveExpenseStack = ({navigation}) => (
  <Stack.Navigator>
    <Stack.Screen
      name="AddOrRemoveExpense"
      component={AddOrRemoveExpense}
      options={{
        headerShown: true,
        title: 'Handle Transaction',
        headerStyle: {
          backgroundColor: '#F5F5F5', // Light gray background (a shade of white)
          elevation: 0, // Remove shadow on Android
        },
        headerTintColor: '#333', // Dark gray text color (a shade of black)
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: 'Kufam-SemiBoldItalic',
          fontSize: 18,
          color: '#333', // Dark gray title color (a shade of black)
        },
      }}
    />
    <Stack.Screen
      name="AddIncome"
      component={AddIncome}
      options={{
        headerTitle: 'Add Income',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
    <Stack.Screen
      name="AddExpense"
      component={AddExpense}
      options={{
        headerTitle: 'Add Expense',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
    <Stack.Screen
      name="TransactionDetail"
      component={TransactionDetailScreen}
      options={{
        headerTitle: 'Transaction Detail',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
    <Stack.Screen
      name="Image"
      component={ImageScreen}
      options={{
        headerTitle: '',
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: '#fff',
          elevation: 0,
        },
      }}
    />
  </Stack.Navigator>
);

const AppStack = ({ navigation }) => {
  return (
    <Tab.Navigator
      screenOptions={{
        activeTintColor: '#2e64e5',
      }}>
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={({route, navigation}) => ({
          headerShown: false,
          headerStyle: {
            backgroundColor: '#FAFAFA', // Light gray background (a shade of white)
            elevation: 0, // Remove shadow on Android
          },
          headerTintColor: '#333', // Dark gray text color (a shade of black)
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontFamily: 'Kufam-SemiBoldItalic',
            fontSize: 18,
            color: '#333', // Dark gray title color (a shade of black)
          },
          tabBarShowLabel: false,
          tabBarIcon: ({color, size, focused}) => (
            <MaterialCommunityIcons name="home" color={focused ? '#677CD2' : color} size={size} />
          ),
        })}
      />
      <Tab.Screen
        name="Statistic"
        component={StatisticStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Statistic',
          tabBarShowLabel: false,
          tabBarIcon: ({color, size, focused}) => (
            <FeatherIcons name="bar-chart-2" color={focused ? '#677CD2' : color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="AddOrRemoveExpense"
        component={AddOrRemoveExpenseStack}
        options={{
          headerShown: false,
          tabBarLabel: 'AddOrRemoveExpense',
          tabBarShowLabel: false,
          tabBarIcon: ({color, size, focused}) => (
            <FontAwesome5 name="plus-circle" color={focused ? '#677CD2' : color} size={size}  />
          ),
        }}
      />
      <Tab.Screen
        name="Saving"
        component={SavingStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Saving',
          tabBarShowLabel: false,
          tabBarIcon: ({color, size, focused}) => (
            <MaterialIcons name="savings" color={focused ? '#677CD2' : color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          headerShown: false,
          // tabBarLabel: 'Home',
          tabBarShowLabel: false,
          tabBarIcon: ({color, size, focused}) => (
            <Ionicons name="person-outline" color={focused ? '#677CD2' : color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default AppStack;
