import React, {useState, useEffect, useContext, useCallback} from 'react';
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
  getDoc,
  getDocs,
  getFirestore,
  writeBatch,
} from '@react-native-firebase/firestore';
import {reportError} from '../src/services/ErrorReporter';
import {useFocusEffect} from '@react-navigation/native';
import * as Application from 'expo-application';
import {version as appVersion} from '../package.json';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import {Avatar, ActivityIndicator, Card, Divider} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useCurrency, CURRENCIES} from '../utils/CurrencyUtil';
import {
  useTheme,
  useThemedStyles,
  type ThemeColors,
  type ThemeMode,
} from '../src/theme';
import type {UserDocument} from '../src/types';
import type {McIconName} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';
import {ModalSnackbar} from '../src/components/Snackbar';

// Accent colours of the settings icons. Each icon circle is the accent at a low alpha, so one
// accent reads on both the light and the dark card.
const ACCENT = {amber: '#FFC107', blue: '#2196F3', green: '#4CAF50'} as const;
const tint = (hex: string): string => `${hex}1F`;

const APPEARANCE_OPTIONS: {mode: ThemeMode; label: string; icon: McIconName}[] =
  [
    {mode: 'system', label: 'System', icon: 'theme-light-dark'},
    {mode: 'light', label: 'Light', icon: 'weather-sunny'},
    {mode: 'dark', label: 'Dark', icon: 'weather-night'},
  ];

const ProfileScreen = ({navigation, route}: {navigation: any; route: any}) => {
  const {colors, mode, setMode} = useTheme();
  const styles = useThemedStyles(createStyles);
  const {logout} = useContext(AuthContext);
  const {currency, setCurrency} = useCurrency();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountActionsExpanded, setAccountActionsExpanded] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  const user = getAuth().currentUser!;

  const getUser = async () => {
    try {
      setLoading(true);
      const snap = await getDoc(fsDoc(getFirestore(), 'users', user.uid));
      if (snap.exists()) {
        setUserData(snap.data() as UserDocument);
        setLoading(false);
      } else {
        throw new Error('User data not found');
      }
    } catch (e: any) {
      reportError(e as Error);
      setLoading(false);
      setError(e.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      getUser();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.key]),
  );

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
      setLoading(true);
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
      setLoading(false);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color={colors.expense}
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={getUser}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContainer}>
        <View style={styles.headerSection}>
          <Text style={styles.headerText}>Profile</Text>
          <Text style={styles.subHeaderText}>Manage your account settings</Text>
        </View>

        <Card
          style={[
            styles.profileCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 2}>
          <View style={styles.profileCardContent}>
            <View style={styles.profileRow}>
              <View style={styles.avatarSection}>
                {userData?.userImg ? (
                  <Avatar.Image source={{uri: userData.userImg}} size={80} />
                ) : (
                  <UserAvatar
                    size={80}
                    bgColor={colors.primaryFill}
                    name={userData?.name ?? ''}
                  />
                )}
                <View style={styles.verificationBadge}>
                  <MaterialCommunityIcons
                    name={verified ? 'check-circle' : 'close-circle'}
                    size={20}
                    color={verified ? colors.income : colors.expense}
                  />
                </View>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{userData?.name ?? 'User'}</Text>
                <Text style={styles.userEmail}>
                  {userData?.email ?? 'user@example.com'}
                </Text>
                <View style={styles.verificationStatus}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: verified
                          ? tint(colors.income)
                          : tint(colors.warning),
                      },
                    ]}>
                    <MaterialCommunityIcons
                      name={verified ? 'shield-check' : 'shield-alert'}
                      size={14}
                      color={verified ? colors.income : colors.warning}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {color: verified ? colors.income : colors.warning},
                      ]}>
                      {verified ? 'Verified' : 'Not Verified'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() =>
                navigation.navigate('EditProfile', {user: userData})
              }>
              <MaterialCommunityIcons
                name="pencil"
                size={20}
                color={colors.onPrimary}
              />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionHeader}>Appearance</Text>
          <Card
            style={[
              styles.settingsCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.appearanceContent}>
              <Text style={styles.settingsItemTitle}>Theme</Text>
              <Text style={styles.settingsItemSubtitle}>
                Choose how TrackaExpense looks
              </Text>
              <View style={styles.segmentRow} accessibilityRole="radiogroup">
                {APPEARANCE_OPTIONS.map(option => {
                  const selected = mode === option.mode;
                  return (
                    <TouchableOpacity
                      key={option.mode}
                      accessibilityRole="radio"
                      accessibilityLabel={`${option.label} theme`}
                      accessibilityState={{selected}}
                      onPress={() => setMode(option.mode)}
                      style={[
                        styles.segment,
                        selected && styles.segmentSelected,
                      ]}>
                      <MaterialCommunityIcons
                        name={option.icon}
                        size={18}
                        color={
                          selected ? colors.onPrimary : colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          selected && styles.segmentTextSelected,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionHeader}>Account Settings</Text>
          <Card
            style={[
              styles.settingsCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => setCurrencyModalVisible(true)}>
              <View style={styles.settingsItemLeft}>
                <View
                  style={[
                    styles.settingsIcon,
                    {backgroundColor: tint(ACCENT.amber)},
                  ]}>
                  <MaterialCommunityIcons
                    name="currency-usd"
                    size={24}
                    color={ACCENT.amber}
                  />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsItemTitle}>Currency</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    {currency.name} ({currency.symbol})
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.iconMuted}
              />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => navigation.navigate('ContactUs')}>
              <View style={styles.settingsItemLeft}>
                <View
                  style={[
                    styles.settingsIcon,
                    {backgroundColor: tint(ACCENT.blue)},
                  ]}>
                  <MaterialCommunityIcons
                    name="account-voice"
                    size={24}
                    color={ACCENT.blue}
                  />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsItemTitle}>Contact Us</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Get help and share feedback
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.iconMuted}
              />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => navigation.navigate('PrivacyPolicy')}>
              <View style={styles.settingsItemLeft}>
                <View
                  style={[
                    styles.settingsIcon,
                    {backgroundColor: tint(ACCENT.green)},
                  ]}>
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={24}
                    color={ACCENT.green}
                  />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsItemTitle}>Privacy Policy</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Learn how we protect your data
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.iconMuted}
              />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => logout()}>
              <View style={styles.settingsItemLeft}>
                <View
                  style={[
                    styles.settingsIcon,
                    {backgroundColor: tint(colors.expense)},
                  ]}>
                  <MaterialCommunityIcons
                    name="logout"
                    size={24}
                    color={colors.expense}
                  />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text
                    style={[styles.settingsItemTitle, {color: colors.expense}]}>
                    Logout
                  </Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Sign out of your account
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.iconMuted}
              />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.settingsSection}>
          <Card
            style={[
              styles.settingsCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => setAccountActionsExpanded(!accountActionsExpanded)}
              activeOpacity={0.7}>
              <View style={styles.settingsItemLeft}>
                <View
                  style={[
                    styles.settingsIcon,
                    {backgroundColor: tint(colors.warning)},
                  ]}>
                  <MaterialCommunityIcons
                    name="shield-alert"
                    size={24}
                    color={colors.warning}
                  />
                </View>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsItemTitle}>Account Actions</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    {accountActionsExpanded
                      ? 'Hide sensitive options'
                      : 'Password, deletion, and other actions'}
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name={accountActionsExpanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={colors.iconMuted}
              />
            </TouchableOpacity>
            {accountActionsExpanded && (
              <View style={styles.collapsibleContent}>
                <Divider style={styles.divider} />
                <TouchableOpacity
                  style={styles.settingsItem}
                  onPress={handleChangePassword}>
                  <View style={styles.settingsItemLeft}>
                    <View
                      style={[
                        styles.settingsIcon,
                        {backgroundColor: tint(ACCENT.blue)},
                      ]}>
                      <MaterialCommunityIcons
                        name="lock-reset"
                        size={24}
                        color={ACCENT.blue}
                      />
                    </View>
                    <View style={styles.settingsTextContainer}>
                      <Text style={styles.settingsItemTitle}>
                        Change Password
                      </Text>
                      <Text style={styles.settingsItemSubtitle}>
                        Reset your password via email
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={colors.iconMuted}
                  />
                </TouchableOpacity>
                <Divider style={styles.divider} />
                <TouchableOpacity
                  style={styles.settingsItem}
                  onPress={handleDeleteAccount}>
                  <View style={styles.settingsItemLeft}>
                    <View
                      style={[
                        styles.settingsIcon,
                        {backgroundColor: tint(colors.expense)},
                      ]}>
                      <MaterialCommunityIcons
                        name="account-remove"
                        size={24}
                        color={colors.expense}
                      />
                    </View>
                    <View style={styles.settingsTextContainer}>
                      <Text
                        style={[
                          styles.settingsItemTitle,
                          {color: colors.expense},
                        ]}>
                        Delete Account
                      </Text>
                      <Text style={styles.settingsItemSubtitle}>
                        Permanently delete your account and data
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={colors.iconMuted}
                  />
                </TouchableOpacity>
                <View style={styles.warningContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={16}
                    color={colors.warning}
                  />
                  <Text style={styles.warningText}>
                    These actions are sensitive and may require additional
                    verification.
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>TrackaExpense v{appVersion}</Text>
          <Text style={styles.versionSubText}>
            Build {Application.nativeBuildVersion ?? appVersion}
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.currencyList}
              showsVerticalScrollIndicator={false}>
              {CURRENCIES.map(curr => (
                <TouchableOpacity
                  key={curr.code}
                  style={[
                    styles.currencyItem,
                    currency.code === curr.code && styles.currencyItemSelected,
                  ]}
                  onPress={() => handleCurrencyChange(curr.code)}>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencySymbol}>{curr.symbol}</Text>
                    <View style={styles.currencyDetails}>
                      <Text style={styles.currencyName}>{curr.name}</Text>
                      <Text style={styles.currencyCode}>{curr.code}</Text>
                    </View>
                  </View>
                  {currency.code === curr.code && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <ModalSnackbar />
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollContainer: {flex: 1},
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 20,
    },
    errorText: {
      fontSize: 16,
      color: colors.expense,
      textAlign: 'center',
      marginVertical: 15,
      fontFamily: 'Lato-Regular',
    },
    retryButton: {
      backgroundColor: colors.primaryFill,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 10,
    },
    retryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Lato-Bold',
    },
    headerSection: {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15},
    headerText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textStrong,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    subHeaderText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Lato-Regular',
    },
    profileCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    profileCardContent: {padding: 24},
    profileRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
    avatarSection: {position: 'relative', marginRight: 16},
    verificationBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 2,
    },
    userInfo: {flex: 1, justifyContent: 'center'},
    userName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      marginBottom: 4,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    userEmail: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 8,
      fontFamily: 'Lato-Regular',
    },
    verificationStatus: {alignItems: 'flex-start'},
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
      fontFamily: 'Lato-Bold',
    },
    editProfileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.primaryFill,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      elevation: Platform.OS === 'android' ? 0 : 3,
      shadowColor: colors.primaryFill,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    editProfileButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onPrimary,
      marginLeft: 8,
      fontFamily: 'Lato-Bold',
    },
    settingsSection: {paddingHorizontal: 20, paddingBottom: 30},
    sectionHeader: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      marginBottom: 15,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    settingsCard: {borderRadius: 16, backgroundColor: colors.surface},
    settingsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    settingsItemLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
    settingsIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    settingsTextContainer: {flex: 1},
    settingsItemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 2,
      fontFamily: 'Lato-Bold',
    },
    settingsItemSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
    },
    divider: {marginHorizontal: 20, backgroundColor: colors.divider},
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    collapsibleContent: {paddingBottom: 8},
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: tint(colors.warning),
      borderRadius: 8,
      padding: 12,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 8,
    },
    warningText: {
      fontSize: 12,
      color: colors.warningText,
      fontFamily: 'Lato-Regular',
      marginLeft: 8,
      flex: 1,
      lineHeight: 16,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 20,
      height: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    currencyList: {paddingHorizontal: 20, paddingTop: 10},
    currencyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginVertical: 4,
      backgroundColor: colors.surfaceMuted,
    },
    currencyItemSelected: {
      backgroundColor: colors.primarySoft,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    currencyInfo: {flexDirection: 'row', alignItems: 'center', flex: 1},
    currencySymbol: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginRight: 16,
      width: 40,
      textAlign: 'center',
    },
    currencyDetails: {flex: 1},
    currencyName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    currencyCode: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: 'Lato-Regular',
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
    versionContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingBottom: 36,
    },
    versionText: {
      fontSize: 13,
      color: colors.textPlaceholder,
      fontFamily: 'Lato-Regular',
    },
    versionSubText: {
      fontSize: 12,
      color: colors.textPlaceholder,
      fontFamily: 'Lato-Regular',
      marginTop: 2,
    },
    appearanceContent: {padding: 20},
    segmentRow: {flexDirection: 'row', gap: 8, marginTop: 14},
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surfaceMuted,
    },
    segmentSelected: {
      backgroundColor: colors.primaryFill,
      borderColor: colors.primaryFill,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      fontFamily: 'Lato-Bold',
    },
    segmentTextSelected: {color: colors.onPrimary},
  });
