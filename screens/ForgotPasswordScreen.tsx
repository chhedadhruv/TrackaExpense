import {View, Text, TouchableOpacity} from 'react-native';
import React, {useState, useContext} from 'react';
import {useRouter} from 'expo-router';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Info from 'lucide-react-native/icons/info';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import Mail from 'lucide-react-native/icons/mail';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {useTheme} from '../src/theme';

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {forgotPassword} = useContext(AuthContext);

  const isValidEmail = (e: string) => /\S+@\S+\.\S+/.test(e);

  const sendResetEmail = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email) {
      setErrorMessage('Please enter an email address');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    try {
      await forgotPassword(email);
      setSuccessMessage(
        'Password reset email sent! Check your inbox and follow the instructions to reset your password.',
      );
      setEmail('');
    } catch (_) {
      setErrorMessage(
        'Error sending reset email. Please check your email address and try again.',
      );
    }
  };
  const {run: handleForgotPassword, pending: isLoading} =
    useAsyncAction(sendResetEmail);

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="w-full flex-1"
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-5 pb-5 pt-10">
          <View className="mb-[30px] items-center">
            <View className="mb-5 h-[100px] w-[100px] items-center justify-center rounded-full bg-primary-soft">
              <LockKeyhole size={60} color={colors.primary} />
            </View>
            <Text className="mb-2.5 font-heading text-[28px] font-bold text-primary">
              Forgot Password?
            </Text>
            <Text className="px-2.5 text-center font-sans text-base leading-[22px] text-text-secondary">
              No worries! Enter your email address and we'll send you a link to
              reset your password
            </Text>
          </View>

          <View className="mb-5 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
            <View className="p-[30px]">
              {errorMessage && (
                <View
                  accessibilityRole="alert"
                  className="mb-5 flex-row items-center rounded-xl border-l-4 border-expense bg-expense-soft p-[15px]">
                  <CircleAlert size={20} color={colors.expenseText} />
                  <Text className="ml-2.5 flex-1 font-sans text-sm leading-[18px] text-expense-text">
                    {errorMessage}
                  </Text>
                </View>
              )}
              {successMessage && (
                <View
                  accessibilityRole="alert"
                  className="mb-5 flex-row items-center rounded-xl border-l-4 border-income bg-income-soft p-[15px]">
                  <CircleCheck size={20} color={colors.incomeText} />
                  <Text className="ml-2.5 flex-1 font-sans text-sm leading-[18px] text-income-text">
                    {successMessage}
                  </Text>
                </View>
              )}
              <View className="mb-5">
                <Text className="mb-2.5 font-sans-bold text-base font-semibold text-primary">
                  Email Address
                </Text>
                <FormInput
                  labelValue={email}
                  onChangeText={setEmail}
                  placeholderText="Enter your email address"
                  icon={Mail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <FormButton
                buttonTitle="Send Reset Email"
                onPress={handleForgotPassword}
                loading={isLoading}
              />
            </View>
          </View>

          <View className="mb-5 rounded-[15px] border border-card-border bg-surface ios:shadow-md">
            <View className="flex-row items-start p-5">
              <Info size={24} color={colors.primary} />
              <View className="ml-[15px] flex-1">
                <Text className="mb-[5px] font-sans-bold text-base font-semibold text-primary">
                  Need Help?
                </Text>
                <Text className="font-sans text-sm leading-[18px] text-text-secondary">
                  If you don't receive the email within a few minutes, check
                  your spam folder or contact support.
                </Text>
              </View>
            </View>
          </View>

          <View className="items-center pb-5">
            <TouchableOpacity
              className="p-[15px]"
              onPress={() => router.navigate('/login')}>
              <Text className="text-center font-sans text-base text-text-secondary">
                Remember your password?{' '}
                <Text className="font-semibold text-primary">Sign in here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default ForgotPasswordScreen;
