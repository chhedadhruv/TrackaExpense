import React, {useState, useEffect, useContext, type ReactNode} from 'react';
import UserAvatar from '../src/components/Avatar';
import {AuthContext} from '../navigation/AuthProvider';
import {
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
} from '@react-native-firebase/auth';
import {
  collection,
  deleteDoc,
  doc as fsDoc,
  getDocs,
  getFirestore,
  writeBatch,
} from '@react-native-firebase/firestore';
import {reportError} from '../src/services/ErrorReporter';
import {useRouter} from 'expo-router';
import {useUserData} from '../src/data/hooks';
import * as Application from 'expo-application';
import {version as appVersion} from '../package.json';
import {runningUpdateId} from '../src/services/AppUpdate';
import {updateLabel} from '../src/utils/otaUpdate';
import {View, Text, TouchableOpacity, ScrollView, Alert} from 'react-native';
import {ActivityIndicator} from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleDollarSign from 'lucide-react-native/icons/circle-dollar-sign';
import CircleX from 'lucide-react-native/icons/circle-x';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import LogOut from 'lucide-react-native/icons/log-out';
import Mic from 'lucide-react-native/icons/mic';
import Pencil from 'lucide-react-native/icons/pencil';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import Repeat from 'lucide-react-native/icons/repeat';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Scale from 'lucide-react-native/icons/scale';
import {getConfig} from '../src/services/RemoteConfigService';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import UserX from 'lucide-react-native/icons/user-x';
import {useCurrency} from '../utils/CurrencyUtil';
import {useTheme} from '../src/theme';
import type {AppIcon} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';
import AppearanceSetting from '../src/components/AppearanceSetting';
import CurrencyPickerModal from '../src/components/CurrencyPickerModal';

// Accent colours of the settings icons. Each icon circle is the accent at a low alpha, so one
// accent reads on both the light and the dark card.
const ACCENT = {amber: '#FFC107', blue: '#2196F3', green: '#4CAF50'} as const;
const tint = (hex: string): string => `${hex}1F`;

interface SettingsRowProps {
  icon: AppIcon;
  /** Icon colour; the circle behind it is the same colour at a low alpha. */
  accent: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Colours the title (for destructive rows). */
  danger?: boolean;
  /** Trailing icon, a chevron by default. */
  trailing?: AppIcon;
  accessibilityState?: {expanded: boolean};
}

/** One tappable row of a settings card. */
const SettingsRow = ({
  icon: Icon,
  accent,
  title,
  subtitle,
  onPress,
  danger = false,
  trailing: Trailing = ChevronRight,
  accessibilityState,
}: SettingsRowProps) => {
  const {colors} = useTheme();
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between px-5 py-4"
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={onPress}
      activeOpacity={0.7}>
      <View className="flex-1 flex-row items-center">
        <View
          className="mr-4 h-12 w-12 items-center justify-center rounded-xl"
          style={{backgroundColor: tint(accent)}}>
          <Icon size={24} color={accent} />
        </View>
        <View className="flex-1">
          <Text
            className={`mb-0.5 font-sans-bold text-base font-semibold ${
              danger ? 'text-expense-text' : 'text-text-strong'
            }`}>
            {title}
          </Text>
          <Text className="font-sans text-sm text-text-secondary">
            {subtitle}
          </Text>
        </View>
      </View>
      <Trailing size={24} color={colors.iconMuted} />
    </TouchableOpacity>
  );
};

const RowDivider = () => <View className="mx-5 h-px bg-divider" />;

const SettingsCard = ({children}: {children: ReactNode}) => (
  <View className="rounded-2xl border border-card-border bg-surface ios:shadow-md">
    {children}
  </View>
);

const ProfileScreen = () => {
  const {colors} = useTheme();
  const router = useRouter();
  const {logout} = useContext(AuthContext);
  const {currency, setCurrency} = useCurrency();
  // The profile comes from the shared cache, which a live listener keeps current (src/data), so
  // there is nothing to fetch when the screen opens or comes back into focus.
  const profile = useUserData();
  const userData = profile.data ?? null;
  const [verified, setVerified] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const loading = profile.loading || deleting;
  const error = profile.error
    ? 'Could not load your profile. Check your connection and try again.'
    : profile.live && !profile.data
    ? 'User data not found'
    : null;
  const [accountActionsExpanded, setAccountActionsExpanded] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  const user = getAuth().currentUser!;

  useEffect(() => {
    if (user.emailVerified || userData?.verified === true) {
      setVerified(true);
    } else {
      setVerified(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'You will be sent a password reset email. Do you want to proceed?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Send Email',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(getAuth(), user.email!);
              snackbar.success(
                'A password reset email has been sent to your email address.',
              );
            } catch (e) {
              reportError(e as Error);
              snackbar.error(
                'Failed to send password reset email. Please try again later.',
              );
            }
          },
        },
      ],
    );
  };

  const deleteAccountPermanently = async () => {
    try {
      setDeleting(true);
      const currentUser = getAuth().currentUser!;
      await deleteDoc(fsDoc(getFirestore(), 'users', currentUser.uid));
      const txSnap = await getDocs(
        collection(getFirestore(), 'users', currentUser.uid, 'transactions'),
      );
      const batch = writeBatch(getFirestore());
      txSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      await deleteUser(currentUser);
      snackbar.success('Your account has been permanently deleted.');
    } catch (e: any) {
      reportError(e as Error);
      setDeleting(false);
      if (e.code === 'auth/requires-recent-login') {
        snackbar.error(
          'Please log out and log back in, then try deleting your account again.',
        );
      } else {
        snackbar.error('Failed to delete account. Please try again later.');
      }
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be permanently deleted. Are you absolutely sure?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Final Confirmation',
              'This is your last chance to cancel.',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Yes, Delete My Account',
                  style: 'destructive',
                  onPress: deleteAccountPermanently,
                },
              ],
            ),
        },
      ],
    );
  };

  const handleCurrencyChange = async (currencyCode: string) => {
    try {
      await setCurrency(currencyCode);
      setCurrencyModalVisible(false);
      snackbar.success('Currency updated successfully!');
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Failed to update currency. Please try again.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-5">
        <CircleAlert size={48} color={colors.expense} />
        <Text
          accessibilityRole="alert"
          className="my-[15px] text-center font-sans text-base text-expense-text">
          {error}
        </Text>
        <TouchableOpacity
          className="mt-2.5 rounded-xl bg-primary-fill px-6 py-3"
          accessibilityRole="button"
          onPress={profile.retry}>
          <Text className="font-sans-bold text-base font-semibold text-on-primary">
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-5 pb-[15px] pt-5">
          <Text
            accessibilityRole="header"
            className="font-heading text-2xl font-bold text-text-strong">
            Profile
          </Text>
          <Text className="mt-1 font-sans text-base text-text-secondary">
            Manage your account settings
          </Text>
        </View>

        <View className="mx-5 mb-5 rounded-2xl border border-card-border bg-surface ios:shadow-md">
          <View className="p-6">
            <View className="flex-row items-center">
              <View className="relative mr-4">
                <UserAvatar
                  size={80}
                  src={userData?.userImg}
                  bgColor={colors.primaryFill}
                  name={userData?.name ?? ''}
                />
                <View className="absolute -bottom-0.5 -right-0.5 rounded-[10px] bg-surface p-0.5">
                  {verified ? (
                    <CircleCheck size={20} color={colors.income} />
                  ) : (
                    <CircleX size={20} color={colors.expense} />
                  )}
                </View>
              </View>
              <View className="flex-1 justify-center">
                <Text className="mb-1 font-heading text-xl font-bold text-text-strong">
                  {userData?.name ?? 'User'}
                </Text>
                <Text className="mb-2 font-sans text-[15px] text-text-secondary">
                  {userData?.email ?? 'user@example.com'}
                </Text>
                <View className="items-start">
                  <View
                    className="flex-row items-center rounded-full px-3 py-1.5"
                    style={{
                      backgroundColor: verified
                        ? tint(colors.income)
                        : tint(colors.warning),
                    }}>
                    {verified ? (
                      <ShieldCheck size={14} color={colors.income} />
                    ) : (
                      <ShieldAlert size={14} color={colors.warning} />
                    )}
                    <Text
                      className={`ml-1.5 font-sans-bold text-sm font-semibold ${
                        verified ? 'text-income' : 'text-warning'
                      }`}>
                      {verified ? 'Verified' : 'Not Verified'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                className="ml-3 h-11 w-11 items-center justify-center rounded-full bg-primary-soft"
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                hitSlop={8}
                onPress={() => router.navigate('/profile/edit')}>
                <Pencil size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="px-5 pb-[30px]">
          <Text
            accessibilityRole="header"
            className="mb-[15px] font-heading text-xl font-bold text-text-strong">
            Appearance
          </Text>
          <SettingsCard>
            <AppearanceSetting />
          </SettingsCard>
        </View>

        <View className="px-5 pb-[30px]">
          <Text
            accessibilityRole="header"
            className="mb-[15px] font-heading text-xl font-bold text-text-strong">
            Account Settings
          </Text>
          <SettingsCard>
            <SettingsRow
              icon={CircleDollarSign}
              accent={ACCENT.amber}
              title="Currency"
              subtitle={`${currency.name} (${currency.symbol})`}
              onPress={() => setCurrencyModalVisible(true)}
            />
            <RowDivider />
            {getConfig().enable_budgets ? (
              <>
                <SettingsRow
                  icon={PiggyBank}
                  accent={ACCENT.green}
                  title="Budgets"
                  subtitle="Set limits and get alerts"
                  onPress={() => router.navigate('/profile/budgets')}
                />
                <RowDivider />
              </>
            ) : null}
            {getConfig().enable_recurring ? (
              <>
                <SettingsRow
                  icon={Repeat}
                  accent={ACCENT.blue}
                  title="Recurring"
                  subtitle="Rent, subscriptions and salary"
                  onPress={() => router.navigate('/profile/recurring')}
                />
                <RowDivider />
              </>
            ) : null}
            {getConfig().enable_balance_adjust ? (
              <>
                <SettingsRow
                  icon={Scale}
                  accent={ACCENT.green}
                  title="Fix my balance"
                  subtitle="Match the app to your real balance"
                  onPress={() => router.navigate('/profile/fix-balance')}
                />
                <RowDivider />
              </>
            ) : null}
            {getConfig().enable_cards ? (
              <>
                <SettingsRow
                  icon={CreditCard}
                  accent={ACCENT.amber}
                  title="Cards"
                  subtitle="Credit card bills and due dates"
                  onPress={() => router.navigate('/profile/cards')}
                />
                <RowDivider />
              </>
            ) : null}
            {getConfig().enable_sms_import ? (
              <>
                <SettingsRow
                  icon={MessageSquareText}
                  accent={ACCENT.amber}
                  title="Bank message"
                  subtitle="Add from a pasted bank SMS"
                  onPress={() => router.navigate('/profile/sms-import')}
                />
                <RowDivider />
              </>
            ) : null}
            <SettingsRow
              icon={Mic}
              accent={ACCENT.blue}
              title="Contact Us"
              subtitle="Get help and share feedback"
              onPress={() => router.navigate('/profile/contact')}
            />
            <RowDivider />
            <SettingsRow
              icon={ShieldCheck}
              accent={ACCENT.green}
              title="Privacy Policy"
              subtitle="Learn how we protect your data"
              onPress={() => router.navigate('/profile/privacy-policy')}
            />
            <RowDivider />
            <SettingsRow
              icon={LogOut}
              accent={colors.expense}
              title="Logout"
              subtitle="Sign out of your account"
              danger
              onPress={() => logout()}
            />
          </SettingsCard>
        </View>

        <View className="px-5 pb-[30px]">
          <SettingsCard>
            <SettingsRow
              icon={ShieldAlert}
              accent={colors.warning}
              title="Account Actions"
              subtitle={
                accountActionsExpanded
                  ? 'Hide sensitive options'
                  : 'Password, deletion, and other actions'
              }
              trailing={accountActionsExpanded ? ChevronUp : ChevronDown}
              accessibilityState={{expanded: accountActionsExpanded}}
              onPress={() => setAccountActionsExpanded(!accountActionsExpanded)}
            />
            {accountActionsExpanded && (
              <View className="pb-2">
                <RowDivider />
                <SettingsRow
                  icon={LockKeyhole}
                  accent={ACCENT.blue}
                  title="Change Password"
                  subtitle="Reset your password via email"
                  onPress={handleChangePassword}
                />
                <RowDivider />
                <SettingsRow
                  icon={UserX}
                  accent={colors.expense}
                  title="Delete Account"
                  subtitle="Permanently delete your account and data"
                  danger
                  onPress={handleDeleteAccount}
                />
                <View className="mx-5 mb-2 mt-4 flex-row items-center rounded-lg bg-warning-soft p-3">
                  <CircleAlert size={16} color={colors.warning} />
                  <Text className="ml-2 flex-1 font-sans text-xs leading-4 text-warning-text">
                    These actions are sensitive and may require additional
                    verification.
                  </Text>
                </View>
              </View>
            )}
          </SettingsCard>
        </View>

        <View className="items-center pb-9 pt-6">
          <Text className="font-sans text-[13px] text-text-placeholder">
            TrackaExpense v{appVersion}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-text-placeholder">
            Build {Application.nativeBuildVersion ?? appVersion}
          </Text>
          <Text
            selectable
            className="mt-0.5 font-sans text-xs text-text-placeholder">
            {updateLabel(runningUpdateId)}
          </Text>
        </View>
      </ScrollView>

      <CurrencyPickerModal
        visible={currencyModalVisible}
        selectedCode={currency.code}
        onSelect={handleCurrencyChange}
        onClose={() => setCurrencyModalVisible(false)}
      />
    </View>
  );
};

export default ProfileScreen;
