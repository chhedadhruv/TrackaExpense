import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {Text, Card, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useCurrency} from '../../utils/CurrencyUtil';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../../src/constants/theme';
import {formatInputAmount} from '../../src/utils/formatters';

type Direction = 'iowe' | 'owesme';

const CreateIOUScreen = ({navigation}: {navigation: any}) => {
  const {currency} = useCurrency();
  const [toEmail, setToEmail] = useState('');
  const [toName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<Direction>('iowe');

  const handleSubmit = async () => {
    const emailTrimmed = toEmail.trim().toLowerCase();
    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const currentUser = getAuth().currentUser;
      const currentEmail = currentUser?.email?.toLowerCase();
      if (emailTrimmed === currentEmail) {
        Alert.alert(
          'Validation Error',
          'You cannot create an IOU with yourself',
        );
        setLoading(false);
        return;
      }
      let resolvedName = toName.trim();
      if (!resolvedName) {
        try {
          const snap = await getDocs(
            query(
              collection(getFirestore(), 'users'),
              where('email', '==', emailTrimmed),
            ),
          );
          if (!snap.empty) {
            resolvedName =
              snap.docs[0].data()?.name || emailTrimmed.split('@')[0];
          } else {
            resolvedName = emailTrimmed.split('@')[0];
          }
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
              notes: notes.trim(),
              status: 'pending',
              createdAt: serverTimestamp(),
            };
      await addDoc(collection(getFirestore(), 'ious'), iouData);
      navigation.goBack();
    } catch (_) {
      Alert.alert('Error', 'Failed to create IOU');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons
                name="handshake"
                size={32}
                color={PRIMARY_COLOR}
              />
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
                  placeholderTextColor="#999"
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
                    placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Create IOU</Text>
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color="#FFFFFF"
                  />
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  headerTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    fontFamily: 'Kufam-SemiBoldItalic',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  cardContent: {padding: 20},
  sectionLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginBottom: 8,
  },
  directionRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#E8EBF7',
    borderRadius: 12,
    padding: 4,
  },
  dirBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  dirBtnActive: {backgroundColor: PRIMARY_COLOR},
  dirBtnText: {fontSize: 13, color: PRIMARY_COLOR, fontFamily: 'Lato-Bold'},
  dirBtnTextActive: {color: '#FFFFFF'},
  inputContainer: {marginBottom: 15},
  inputLabel: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Lato-Regular',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E4F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
    backgroundColor: '#F9FAFF',
  },
  notesInput: {minHeight: 70, textAlignVertical: 'top', paddingTop: 10},
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E4F0',
    borderRadius: 12,
    backgroundColor: '#F9FAFF',
  },
  currencySymbol: {
    fontSize: 18,
    color: PRIMARY_COLOR,
    paddingLeft: 14,
    fontFamily: 'Lato-Bold',
  },
  amountInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  buttonContainer: {marginHorizontal: 20, marginBottom: 40},
  submitButton: {
    backgroundColor: PRIMARY_COLOR,
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
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
  },
});
