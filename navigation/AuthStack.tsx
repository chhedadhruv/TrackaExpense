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

const Stack = createStackNavigator<AuthStackParamList>();

const renderHeaderLeft = (
  navigation: StackNavigationProp<AuthStackParamList>,
  targetScreen: keyof AuthStackParamList,
) => (
  <View style={{marginLeft: 10}}>
    <FontAwesome.Button
      name="long-arrow-left"
      size={25}
      backgroundColor="#f9fafd"
      color="#333"
      onPress={() => navigation.navigate(targetScreen as never)}
    />
  </View>
);

const AuthStack = () => {
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
            backgroundColor: '#f9fafd',
            shadowColor: '#f9fafd',
            elevation: 0,
          },
          headerLeft: () => renderHeaderLeft(navigation as any, 'Login'),
        })}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={({navigation}) => ({
          headerStatusBarHeight: 0,
          title: '',
          headerStyle: {
            backgroundColor: '#f9fafd',
            shadowColor: '#f9fafd',
            elevation: 0,
          },
          headerLeft: () => renderHeaderLeft(navigation as any, 'Login'),
        })}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
