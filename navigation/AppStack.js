import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';

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
      name="Profile"
      component={ProfileScreen}
      options={{
        headerTitleAlign: 'center',
        headerTitleStyle: {
          color: '#2e64e5',
          fontFamily: 'Kufam-SemiBoldItalic',
          fontSize: 18,
        },
        headerStyle: {
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
          tabBarShowLabel: false,
          tabBarIcon: ({color, size}) => (
            <MaterialCommunityIcons
              name="home-outline"
              color={color}
              size={size}
            />
          ),
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          headerShown: false,
          // tabBarLabel: 'Home',
          tabBarShowLabel: false,
          tabBarIcon: ({color, size}) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default AppStack;
