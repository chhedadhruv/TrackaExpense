import {View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type {StackNavigationProp} from '@react-navigation/stack';
import type {AuthStackParamList} from '../src/types';
import {useTheme, type ThemeColors} from '../src/theme';

const Stack = createStackNavigator<AuthStackParamList>();

const renderHeaderLeft = (
  navigation: StackNavigationProp<AuthStackParamList>,
  targetScreen: keyof AuthStackParamList,
  colors: ThemeColors,
) => (
  <View style={{marginLeft: 10}}>
    <FontAwesome.Button
      name="long-arrow-left"
      size={25}
      backgroundColor={colors.background}
      color={colors.text}
      accessibilityLabel="Back"
      onPress={() => navigation.navigate(targetScreen as never)}
    />
  </View>
);

const AuthStack = () => {
  const {colors} = useTheme();
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const alreadyLaunched = await AsyncStorage.getItem('alreadyLaunched');
        if (alreadyLaunched === null) {
          await AsyncStorage.setItem('alreadyLaunched', 'true');
          setIsFirstLaunch(true);
        } else {
          setIsFirstLaunch(false);
        }
      } catch (_) {
        setIsFirstLaunch(false);
      }
    };
    checkFirstLaunch();
  }, []);

  if (isFirstLaunch === null) return null;

  return (
    <Stack.Navigator initialRouteName={isFirstLaunch ? 'Onboarding' : 'Login'}>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={({navigation}) => ({
          headerStatusBarHeight: 0,
          title: '',
          headerStyle: {
            backgroundColor: colors.background,
            shadowColor: colors.background,
            elevation: 0,
          },
          headerLeft: () =>
            renderHeaderLeft(navigation as any, 'Login', colors),
        })}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={({navigation}) => ({
          headerStatusBarHeight: 0,
          title: '',
          headerStyle: {
            backgroundColor: colors.background,
            shadowColor: colors.background,
            elevation: 0,
          },
          headerLeft: () =>
            renderHeaderLeft(navigation as any, 'Login', colors),
        })}
      />
      {/* Signup links to the policy, which was imported here but never registered. */}
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={({navigation}) => ({
          headerStatusBarHeight: 0,
          title: '',
          headerStyle: {
            backgroundColor: colors.background,
            shadowColor: colors.background,
            elevation: 0,
          },
          headerLeft: () =>
            renderHeaderLeft(navigation as any, 'Signup', colors),
        })}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
