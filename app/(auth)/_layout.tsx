import React from 'react';
import {View} from 'react-native';
import {useRouter} from 'expo-router';
import {Stack} from 'expo-router/js-stack';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {useTheme} from '../../src/theme';
import {useAuthStackOptions} from '../../src/navigation/stackOptions';

interface BackProps {
  /** Where the arrow goes: the screen the person came from. */
  to: '/login' | '/signup';
}

const BackArrow = ({to}: BackProps) => {
  const {colors} = useTheme();
  const router = useRouter();
  return (
    <View className="ml-2.5">
      <FontAwesome.Button
        name="long-arrow-left"
        size={25}
        backgroundColor={colors.background}
        color={colors.text}
        accessibilityLabel="Back"
        onPress={() => router.navigate(to)}
      />
    </View>
  );
};

const loginBack = () => <BackArrow to="/login" />;
const signupBack = () => <BackArrow to="/signup" />;

const AuthLayout = () => {
  const quiet = useAuthStackOptions();
  return (
    <Stack>
      <Stack.Screen name="onboarding" options={{headerShown: false}} />
      <Stack.Screen name="login" options={{headerShown: false}} />
      <Stack.Screen name="signup" options={{...quiet, headerLeft: loginBack}} />
      <Stack.Screen
        name="forgot-password"
        options={{...quiet, headerLeft: loginBack}}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{...quiet, headerLeft: signupBack}}
      />
    </Stack>
  );
};

export default AuthLayout;
