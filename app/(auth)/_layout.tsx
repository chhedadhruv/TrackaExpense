import React from 'react';
import {Pressable} from 'react-native';
import {useRouter} from 'expo-router';
import {Stack} from 'expo-router/js-stack';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
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
    <Pressable
      className="ml-2.5 p-3"
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.navigate(to)}>
      <ArrowLeft size={25} color={colors.text} />
    </Pressable>
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
