import React, {useState} from 'react';
import {useRouter} from 'expo-router';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {ActivityIndicator} from 'react-native';
import Card from '../../src/components/Card';
import Text from '../../src/components/Text';
import Check from 'lucide-react-native/icons/check';
import Handshake from 'lucide-react-native/icons/handshake';
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {lookupUserByEmail} from '../../src/services/UserLookup';
import {getAuth} from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import {useCurrency} from '../../utils/CurrencyUtil';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {formatInputAmount} from '../../src/utils/formatters';
import {transactionMoneyFields} from '../../src/utils/amounts';
import {snackbar} from '../../src/utils/snackbarStore';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import {useAsyncAction} from '../../src/hooks/useAsyncAction';

type Direction = 'iowe' | 'owesme';

const CreateIOUScreen = () => {
  const router = useRouter();
  const {currency} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const [toEmail, setToEmail] = useState('');
  const [toName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [direction, setDirection] = useState<Direction>('iowe');

  const createIOU = async () => {
    const emailTrimmed = toEmail.trim().toLowerCase();
    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      snackbar.error('Please enter a valid email address');
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      snackbar.error('Please enter a valid amount');
      return;
    }
    try {
      const currentUser = getAuth().currentUser;
      const currentEmail = currentUser?.email?.toLowerCase();
      if (emailTrimmed === currentEmail) {
        snackbar.error('You cannot create an IOU with yourself');
        return;
      }
      let resolvedName = toName.trim();
      if (!resolvedName) {
        try {
          const found = await lookupUserByEmail(emailTrimmed);
          resolvedName = found?.name || emailTrimmed.split('@')[0];
        } catch (_) {
          resolvedName = emailTrimmed.split('@')[0];
        }
      }
      const currentUserName =
        currentUser?.displayName || currentEmail?.split('@')[0] || 'Me';
      const iouData =
        direction === 'iowe'
          ? {
              fromEmail: currentEmail,
              fromName: currentUserName,
              fromUserId: currentUser?.uid,
              toEmail: emailTrimmed,
              toName: resolvedName,
              amount: parseFloat(amount),
              ...transactionMoneyFields(amount, currency.code),
              notes: notes.trim(),
              status: 'pending',
              createdAt: serverTimestamp(),
            }
          : {
              fromEmail: emailTrimmed,
              fromName: resolvedName,
              fromUserId: null,
              toEmail: currentEmail,
              toName: currentUserName,
              amount: parseFloat(amount),
              ...transactionMoneyFields(amount, currency.code),
              notes: notes.trim(),
              status: 'pending',
              createdAt: serverTimestamp(),
            };
      await addDoc(collection(getFirestore(), 'ious'), iouData);
      AnalyticsService.logIouCreated({
        direction,
        amount_range: AnalyticsService.getAmountRange(parseFloat(amount)),
      });
      router.back();
    } catch (_) {
      snackbar.error('Failed to create IOU');
    }
  };
  const {run: handleSubmit, pending: loading} = useAsyncAction(createIOU);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <Handshake size={32} color={colors.primary} />
              <Text style={styles.headerTitle}>New IOU</Text>
            </View>
            <Text style={styles.headerSubtitle}>Record a personal debt</Text>
          </View>
          <Card
            style={[
              styles.formCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionLabel}>Direction</Text>
              <View style={styles.directionRow}>
                <TouchableOpacity
                  style={[
                    styles.dirBtn,
                    direction === 'iowe' && styles.dirBtnActive,
                  ]}
                  onPress={() => setDirection('iowe')}>
                  <Text
                    style={[
                      styles.dirBtnText,
                      direction === 'iowe' && styles.dirBtnTextActive,
                    ]}>
                    I Owe Someone
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dirBtn,
                    direction === 'owesme' && styles.dirBtnActive,
                  ]}
                  onPress={() => setDirection('owesme')}>
                  <Text
                    style={[
                      styles.dirBtnText,
                      direction === 'owesme' && styles.dirBtnTextActive,
                    ]}>
                    Someone Owes Me
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {direction === 'iowe' ? 'I owe (email)' : 'Owes me (email)'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter their email address"
                  placeholderTextColor={colors.textPlaceholder}
                  value={toEmail}
                  onChangeText={setToEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Amount ({currency.symbol})
                </Text>
                <View style={styles.amountRow}>
                  <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textPlaceholder}
                    value={formatInputAmount(amount)}
                    onChangeText={text => setAmount(text.replace(/,/g, ''))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  placeholder="What's this for?"
                  placeholderTextColor={colors.textPlaceholder}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={200}
                  numberOfLines={3}
                />
              </View>
            </View>
          </Card>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Create IOU</Text>
                  <Check size={20} color={colors.onPrimary} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default CreateIOUScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
    headerSection: {
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 30,
      paddingBottom: 20,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      fontFamily: 'Kufam-SemiBoldItalic',
      marginLeft: 12,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginHorizontal: 20,
      marginBottom: 20,
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
    cardContent: {padding: 20},
    sectionLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
      marginBottom: 8,
    },
    directionRow: {
      flexDirection: 'row',
      marginBottom: 20,
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      padding: 4,
    },
    dirBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    dirBtnActive: {backgroundColor: colors.primaryFill},
    dirBtnText: {fontSize: 13, color: colors.primary, fontFamily: 'Lato-Bold'},
    dirBtnTextActive: {color: colors.onPrimary},
    inputContainer: {marginBottom: 15},
    inputLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
      marginBottom: 6,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
      backgroundColor: colors.surfaceMuted,
    },
    notesInput: {minHeight: 70, textAlignVertical: 'top', paddingTop: 10},
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    currencySymbol: {
      fontSize: 18,
      color: colors.primary,
      paddingLeft: 14,
      fontFamily: 'Lato-Bold',
    },
    amountInput: {
      flex: 1,
      padding: 14,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    buttonContainer: {marginHorizontal: 20, marginBottom: 40},
    submitButton: {
      backgroundColor: colors.primaryFill,
      borderRadius: 16,
      padding: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onPrimary,
      fontFamily: 'Lato-Bold',
    },
  });
