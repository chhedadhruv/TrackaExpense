import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Platform,
  Image,
  Modal,
} from 'react-native';
import {
  NOTIFICATION_SERVER_URL,
  EXPO_PUBLIC_NOTIFICATION_SERVER_URL,
} from '@env';
import {
  getDownloadURL,
  getStorage,
  putFile,
  ref as createStorageRef,
} from '@react-native-firebase/storage';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {requestCameraPermission} from '../../utils/Permissions';
import {Card, Checkbox, ActivityIndicator, Switch} from 'react-native-paper';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../../src/services/ErrorReporter';
import * as PerformanceService from '../../src/services/PerformanceService';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import {DatePickerModal} from 'react-native-paper-dates';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import SplitNotificationService from '../../services/SplitNotificationService';
import {useCurrency} from '../../utils/CurrencyUtil';
import {
  SPLIT_CATEGORIES,
  EXPENSE_KEYWORD_MAP,
  getCategoryIcon,
  getCategoryLabel,
} from '../../utils/CategoryData';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../../src/constants/theme';
import {formatInputAmount} from '../../src/utils/formatters';

type SplitType = 'equal' | 'percentage';
type RecurringFrequency = 'weekly' | 'monthly';

interface GroupMember {
  email: string;
  name: string;
  userId: string | null;
  [key: string]: unknown;
}

interface SplitUser {
  email: string;
  name: string;
  userId: string | null;
  percentage?: number;
}

interface RecurringConfig {
  enabled: boolean;
  frequency: RecurringFrequency;
  nextDate: ReturnType<typeof Timestamp.fromDate>;
}

interface SplitData {
  title: string;
  amount: number;
  paidBy: {email: string; name: string; userId: string | null};
  splitType: SplitType;
  splitUsers: SplitUser[];
  category: string | null;
  notes: string;
  imageUrl: string | null;
  recurring: RecurringConfig | null;
  currency: string;
  date: ReturnType<typeof Timestamp.fromDate>;
  createdAt: ReturnType<typeof Timestamp.fromDate>;
}

interface ExistingSplit {
  id: string;
  title: string;
  amount: number;
  paidBy: {email: string; name: string; userId: string | null};
  splitType?: SplitType;
  splitUsers: SplitUser[];
  category?: string | null;
  notes?: string;
  imageUrl?: string | null;
  recurring?: {enabled?: boolean; frequency?: RecurringFrequency} | null;
  date?: {toDate: () => Date};
  createdAt: {toDate: () => Date};
}

interface Group {
  id: string;
  name: string;
  members?: string[];
}

const CreateSplitScreen = ({route, navigation}: any) => {
  const {currency} = useCurrency();
  const [isSplitByPercentage, setIsSplitByPercentage] = useState(false);
  const {group, split}: {group: Group; split?: ExistingSplit} =
    route.params || {};
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<GroupMember | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedPercentages, setSelectedPercentages] = useState<
    Record<string, string>
  >({});
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [date, setDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [_uploading, _setUploading] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] =
    useState<RecurringFrequency>('monthly');
  const [includeInTransactions, setIncludeInTransactions] = useState(true);
  const isEditMode = !!split;

  useEffect(() => {
    if (!group || !group.id) {
      Alert.alert('Error', 'Group information is missing');
      navigation.goBack();
      return;
    }
    fetchGroupMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  useEffect(() => {
    if (isEditMode && groupMembers.length > 0 && split) {
      setTitle(split.title);
      setAmount(split.amount.toString());
      setCategory(split.category ?? null);
      setNotes(split.notes || '');
      setReceiptImage(split.imageUrl || null);
      setRecurringEnabled(split.recurring?.enabled || false);
      setRecurringFrequency(split.recurring?.frequency || 'monthly');
      setDate(split.date?.toDate() || split.createdAt.toDate());

      const paidByMember = groupMembers.find(
        member => member.email === split.paidBy.email,
      );
      setPaidBy(paidByMember ?? null);

      const resolvedSplitType: SplitType =
        split.splitType ||
        (split.splitUsers.some(user => user.percentage)
          ? 'percentage'
          : 'equal');
      setIsSplitByPercentage(resolvedSplitType === 'percentage');

      const initialSelectedUsers: Record<string, boolean> = {};
      const initialSelectedPercentages: Record<string, string> = {};
      groupMembers.forEach(member => {
        const splitUser = split.splitUsers.find(
          user => user.email === member.email,
        );
        initialSelectedUsers[member.email] = true;
        initialSelectedPercentages[member.email] = splitUser?.percentage
          ? splitUser.percentage.toString()
          : (100 / groupMembers.length).toFixed(2);
      });
      setSelectedUsers(initialSelectedUsers);
      setSelectedPercentages(initialSelectedPercentages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split, groupMembers]);

  const fetchGroupMembers = async () => {
    try {
      const groupDoc = await getDoc(doc(getFirestore(), 'groups', group.id));
      const membersData: string[] = groupDoc.data()?.members || [];
      const memberPromises = membersData.map(async email => {
        const userSnapshot = await getDocs(
          query(
            collection(getFirestore(), 'users'),
            where('email', '==', email),
          ),
        );
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          return {
            email,
            name: userData.name || userData.displayName || email.split('@')[0],
            userId: userSnapshot.docs[0].id,
            ...userData,
          };
        }
        return {email, name: email.split('@')[0], userId: null};
      });
      const formattedMembers: GroupMember[] = await Promise.all(memberPromises);

      const defaultPercentage = (100 / formattedMembers.length).toFixed(2);
      const initialSelectedUsers: Record<string, boolean> = {};
      const initialSelectedPercentages: Record<string, string> = {};
      formattedMembers.forEach(member => {
        initialSelectedUsers[member.email] = true;
        initialSelectedPercentages[member.email] = defaultPercentage;
      });

      const currentUserEmail = getAuth().currentUser?.email;
      const currentUserMember = formattedMembers.find(
        member => member.email === currentUserEmail,
      );
      if (currentUserMember) {
        setPaidBy(currentUserMember);
      }

      setGroupMembers(formattedMembers);
      setSelectedUsers(initialSelectedUsers);
      setSelectedPercentages(initialSelectedPercentages);
      setLoading(false);
    } catch (error) {
      reportError(error as Error);
      Alert.alert('Error', 'Failed to load group members');
      navigation.goBack();
    }
  };

  useEffect(() => {
    setIsSplitByPercentage(splitType === 'percentage');
  }, [splitType]);

  useEffect(() => {
    if (title.trim().length < 3 || category) {
      return;
    }
    const lower = title.toLowerCase();
    const match = Object.keys(EXPENSE_KEYWORD_MAP).find(kw =>
      lower.includes(kw),
    );
    const suggested = match ? EXPENSE_KEYWORD_MAP[match] : null;
    const validSplitValues = SPLIT_CATEGORIES.map((c: any) => c.value);
    if (suggested && validSplitValues.includes(suggested)) {
      setCategory(suggested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const updatePercentages = (email: string, newValue: string) => {
    const selectedEmails = Object.entries(selectedUsers)
      .filter(([, isSelected]) => isSelected)
      .map(([e]) => e);
    if (selectedEmails.length === 0) {
      return;
    }

    const newPercentage = parseFloat(newValue) || 0;
    const remainingPercentage = 100 - newPercentage;
    const otherSelectedUsers = selectedEmails.filter(e => e !== email);
    if (otherSelectedUsers.length === 0) {
      return;
    }

    const percentagePerUser = (
      remainingPercentage / otherSelectedUsers.length
    ).toFixed(2);
    const updatedPercentages = {...selectedPercentages};
    updatedPercentages[email] = newValue;
    otherSelectedUsers.forEach(userEmail => {
      updatedPercentages[userEmail] = percentagePerUser;
    });
    setSelectedPercentages(updatedPercentages);
  };

  const toggleUserSelection = (userEmail: string) => {
    const currentlySelected = Object.entries(selectedUsers)
      .filter(([, isSelected]) => isSelected)
      .map(([email]) => email);
    if (
      currentlySelected.length === 1 &&
      currentlySelected[0] === userEmail &&
      selectedUsers[userEmail]
    ) {
      Alert.alert(
        'Error',
        'At least one person must be included in the split.',
      );
      return;
    }
    const newSelectedUsers = {
      ...selectedUsers,
      [userEmail]: !selectedUsers[userEmail],
    };
    setSelectedUsers(newSelectedUsers);

    const selectedEmails = Object.entries(newSelectedUsers)
      .filter(([, isSelected]) => isSelected)
      .map(([email]) => email);
    if (selectedEmails.length > 0) {
      const equalPercentage = (100 / selectedEmails.length).toFixed(2);
      const newPercentages: Record<string, string> = {};
      selectedEmails.forEach(email => {
        newPercentages[email] = equalPercentage;
      });
      setSelectedPercentages(newPercentages);
    }
  };

  const onDismissDatePicker = () => setDatePickerVisible(false);

  const onConfirmDate = (params: {date: Date}) => {
    setDatePickerVisible(false);
    setDate(params.date);
  };

  const handleSubmit = async () => {
    if (!title) {
      Alert.alert('Validation Error', 'Please enter a split title');
      return;
    }
    if (title.trim().length > 100) {
      Alert.alert('Validation Error', 'Title must be 100 characters or less');
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) <= 0) {
      Alert.alert('Validation Error', 'Amount must be greater than 0');
      return;
    }
    if (parseFloat(amount) > 999999999) {
      Alert.alert('Validation Error', 'Amount must be less than 999,999,999');
      return;
    }
    if (!paidBy) {
      Alert.alert('Validation Error', 'Please select who paid for this split');
      return;
    }
    if (!category) {
      Alert.alert('Validation Error', 'Please select a category');
      return;
    }

    const selectedUsersList = Object.entries(selectedUsers)
      .filter(([, isSelected]) => isSelected)
      .map(([email]) => groupMembers.find(member => member.email === email))
      .filter((m): m is GroupMember => !!m);

    if (selectedUsersList.length === 0) {
      Alert.alert(
        'Validation Error',
        'Please select at least one user to split with',
      );
      return;
    }

    if (isSplitByPercentage) {
      const percentageTotal = selectedUsersList.reduce((total, user) => {
        return total + parseFloat(selectedPercentages[user.email] || '0');
      }, 0);
      if (percentageTotal !== 100) {
        Alert.alert(
          'Validation Error',
          'Total percentage must equal 100% for selected users',
        );
        return;
      }
    }

    setLoading(true);
    let newSplitId: string | null = null;
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      const currentUserEmail = currentUser.email;
      let actorNameResolved = currentUserEmail?.split('@')[0] || 'Someone';
      try {
        const userDoc = await getDoc(
          doc(getFirestore(), 'users', currentUser.uid),
        );
        const profileName = userDoc.data()?.name;
        if (profileName && profileName.toLowerCase() !== 'me') {
          actorNameResolved = profileName;
        }
      } catch (e) {
        reportError(e as Error);
      }

      let imageUrl: string | null = null;
      if (receiptImage && !receiptImage.startsWith('http')) {
        imageUrl = await uploadReceiptImage();
      } else if (receiptImage) {
        imageUrl = receiptImage;
      }

      const splitAmount = parseFloat(amount);
      const splitDate = Timestamp.fromDate(date);
      const splitData: SplitData = {
        title,
        amount: splitAmount,
        paidBy: {
          email: paidBy.email,
          name: paidBy.name,
          userId: paidBy.userId,
        },
        splitType: isSplitByPercentage ? 'percentage' : 'equal',
        splitUsers: isSplitByPercentage
          ? selectedUsersList.map(user => ({
              ...user,
              percentage: parseFloat(selectedPercentages[user.email]),
            }))
          : selectedUsersList,
        category,
        notes: notes.trim(),
        imageUrl: imageUrl || null,
        recurring: recurringEnabled
          ? {
              enabled: true,
              frequency: recurringFrequency,
              nextDate: Timestamp.fromDate(
                recurringFrequency === 'weekly'
                  ? new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000)
                  : new Date(
                      date.getFullYear(),
                      date.getMonth() + 1,
                      date.getDate(),
                    ),
              ),
            }
          : null,
        currency: (currency as any).code || 'INR',
        date: splitDate,
        createdAt: isEditMode
          ? (split!.createdAt as any)
          : Timestamp.fromDate(new Date()),
      };

      const splitsCollection = collection(
        getFirestore(),
        'groups',
        group.id,
        'splits',
      );

      if (isEditMode && split) {
        const splitRef = doc(splitsCollection, split.id);
        await updateDoc(splitRef, {...splitData});

        try {
          const groupDataForNotify = {
            id: group.id,
            name: group.name,
            members: groupMembers.map(m => m.email),
          };
          await SplitNotificationService.notifySplitUpdated(
            {id: split.id, ...splitData} as any,
            groupDataForNotify as any,
            actorNameResolved,
            {},
          );
        } catch (e) {
          reportError(e as Error);
        }

        try {
          const changeItems: Array<{
            field: string;
            before: unknown;
            after: unknown;
          }> = [];

          if (split.title !== splitData.title) {
            changeItems.push({
              field: 'title',
              before: split.title,
              after: splitData.title,
            });
          }
          if (parseFloat(String(split.amount)) !== splitData.amount) {
            changeItems.push({
              field: 'amount',
              before: parseFloat(String(split.amount)),
              after: splitData.amount,
            });
          }
          if ((split.category || null) !== (splitData.category || null)) {
            changeItems.push({
              field: 'category',
              before: split.category || null,
              after: splitData.category || null,
            });
          }
          const prevDate =
            split.date?.toDate?.() || split.createdAt?.toDate?.();
          const newDate = splitData.date?.toDate?.() || null;
          if (
            (prevDate?.getTime?.() || null) !== (newDate?.getTime?.() || null)
          ) {
            changeItems.push({
              field: 'date',
              before: prevDate ? prevDate.toISOString() : null,
              after: newDate ? newDate.toISOString() : null,
            });
          }
          if (
            (split.paidBy?.email || null) !== (splitData.paidBy?.email || null)
          ) {
            changeItems.push({
              field: 'paidBy',
              before: split.paidBy?.email || null,
              after: splitData.paidBy?.email || null,
            });
          }
          if (
            (split.splitType || 'equal') !== (splitData.splitType || 'equal')
          ) {
            changeItems.push({
              field: 'splitType',
              before: split.splitType || 'equal',
              after: splitData.splitType || 'equal',
            });
          }

          const hasSplitUsersChanged = (
            prev: ExistingSplit,
            next: SplitData,
          ): boolean => {
            const prevUsers = Array.isArray(prev?.splitUsers)
              ? prev.splitUsers
              : [];
            const nextUsers = Array.isArray(next?.splitUsers)
              ? next.splitUsers
              : [];
            if (prevUsers.length !== nextUsers.length) {
              return true;
            }
            const toKey = (u: SplitUser) =>
              (u.email || u.name || '').toLowerCase();
            const prevMap = new Map(prevUsers.map(u => [toKey(u), u]));
            for (const u of nextUsers) {
              const key = toKey(u);
              const pu = prevMap.get(key);
              if (!pu) {
                return true;
              }
              const prevPct =
                pu.percentage != null ? Number(pu.percentage).toFixed(2) : null;
              const nextPct =
                u.percentage != null ? Number(u.percentage).toFixed(2) : null;
              if (prevPct !== nextPct) {
                return true;
              }
            }
            return false;
          };

          const summarizeUsers = (s: ExistingSplit | SplitData): string => {
            const isPct =
              (s.splitType || split.splitType || 'equal') === 'percentage' ||
              (s.splitUsers || []).some(u => u.percentage != null);
            const users = (s.splitUsers || [])
              .slice()
              .sort((a, b) => {
                const ka = (a.email || a.name || '').toLowerCase();
                const kb = (b.email || b.name || '').toLowerCase();
                return ka.localeCompare(kb);
              })
              .map(u =>
                isPct
                  ? `${u.name || u.email}(${Number(u.percentage).toFixed(2)}%)`
                  : `${u.name || u.email}`,
              );
            return users.join(', ');
          };

          if (hasSplitUsersChanged(split, splitData)) {
            changeItems.push({
              field: 'splitUsers',
              before: summarizeUsers(split),
              after: summarizeUsers(splitData),
            });
          }

          const historyEntry = {
            type: 'update',
            groupId: group.id,
            groupName: group.name,
            splitId: split.id,
            splitTitle: title,
            amount: splitAmount,
            category,
            date: splitData.date,
            paidBy: splitData.paidBy,
            splitType: splitData.splitType,
            changes: changeItems,
            actorUid: currentUser.uid,
            actorEmail: currentUserEmail,
            actorName: actorNameResolved,
            createdAt: serverTimestamp(),
          };

          await addDoc(
            collection(
              getFirestore(),
              'users',
              currentUser.uid,
              'splitHistory',
            ),
            historyEntry,
          );

          await addDoc(
            collection(getFirestore(), 'groups', group.id, 'splitHistory'),
            historyEntry,
          );
        } catch (histErr) {
          reportError(histErr as Error);
        }

        await writeSplitTransaction(
          split.id,
          splitAmount,
          splitData,
          true,
          includeInTransactions,
        );
      } else {
        const splitRef = await addDoc(splitsCollection, splitData);
        newSplitId = splitRef.id;

        SplitNotificationService.notifySplitCreated(
          {id: splitRef.id, ...splitData} as any,
          {
            id: group.id,
            name: group.name,
            members: groupMembers.map(m => m.email),
          } as any,
          actorNameResolved,
        ).catch(e => reportError(e as Error));

        try {
          const historyEntry = {
            type: 'create',
            groupId: group.id,
            groupName: group.name,
            splitId: splitRef.id,
            splitTitle: title,
            amount: splitAmount,
            category,
            date: splitData.date,
            paidBy: splitData.paidBy,
            splitType: splitData.splitType,
            actorUid: currentUser.uid,
            actorEmail: currentUserEmail,
            actorName: actorNameResolved,
            createdAt: serverTimestamp(),
          };

          await addDoc(
            collection(
              getFirestore(),
              'users',
              currentUser.uid,
              'splitHistory',
            ),
            historyEntry,
          );

          await addDoc(
            collection(getFirestore(), 'groups', group.id, 'splitHistory'),
            historyEntry,
          );
        } catch (histErr) {
          reportError(histErr as Error);
        }

        await writeSplitTransaction(
          splitRef.id,
          splitAmount,
          splitData,
          false,
          includeInTransactions,
        );
      }

      if (!isEditMode) {
        AnalyticsService.logCreateSplit({
          split_type: splitType || 'equal',
          is_recurring: recurringEnabled,
          category: category ?? 'other',
          member_count: selectedUsersList.length,
        });
      }
      setLoading(false);
      if (isEditMode) {
        Alert.alert('Success', 'Split updated successfully', [
          {text: 'OK', onPress: () => navigation.goBack()},
        ]);
      } else {
        navigation.navigate('SplitGroupDetail', {
          group,
          newSplit: newSplitId ? {id: newSplitId, ...splitData} : undefined,
          showSuccessToast: true,
        });
      }
    } catch (error) {
      reportError(error as Error);
      setLoading(false);
      Alert.alert(
        'Error',
        `Failed to ${
          isEditMode ? 'update' : 'create'
        } split. Please try again.`,
      );
    }
  };

  const writeSplitTransaction = async (
    splitId: string,
    amount: number,
    data: SplitData,
    isEdit: boolean,
    include: boolean,
  ) => {
    try {
      const u = getAuth().currentUser;
      if (!u) {
        return;
      }
      const email = u.email?.toLowerCase();
      const isPayer = data.paidBy?.email?.toLowerCase() === email;

      if (!isPayer && data.paidBy?.userId && include) {
        try {
          const endpoint =
            NOTIFICATION_SERVER_URL ||
            EXPO_PUBLIC_NOTIFICATION_SERVER_URL ||
            '';
          if (endpoint) {
            const dateStr = data.date.toDate().toISOString().split('T')[0];
            await fetch(
              `${endpoint.replace(/\/$/, '')}/createSplitTransaction`,
              {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  targetUserId: data.paidBy.userId,
                  txData: {
                    title: data.title,
                    type: 'expense',
                    category: data.category || 'Split',
                    amount: String(parseFloat(amount.toFixed(2))),
                    date: dateStr,
                    source: 'split',
                    splitId,
                    groupId: group.id,
                    groupName: group.name,
                    splitRole: 'payer',
                  },
                  balanceDelta: -amount,
                  isEdit,
                }),
              },
            );
          }
        } catch (serverErr) {}
        return;
      }

      if (!isPayer) {
        if (!include) {
        } else {
        }
        return;
      }

      const txCol = collection(getFirestore(), 'users', u.uid, 'transactions');
      const userRef = doc(getFirestore(), 'users', u.uid);

      if (!include) {
        if (isEdit) {
          const snap = await getDocs(
            query(txCol, where('splitId', '==', splitId)),
          );
          if (!snap.empty) {
            const oldAmount = parseFloat(snap.docs[0].data().amount || '0');
            await deleteDoc(snap.docs[0].ref);
            if (oldAmount > 0) {
              await updateDoc(userRef, {
                balance: increment(oldAmount),
              });
            }
          } else {
          }
        }
        return;
      }

      const dateStr = data.date.toDate().toISOString().split('T')[0];
      const txData = {
        title: data.title,
        type: 'expense',
        category: data.category || 'Split',
        amount: String(parseFloat(amount.toFixed(2))),
        date: dateStr,
        source: 'split',
        splitId,
        groupId: group.id,
        groupName: group.name,
        splitRole: 'payer',
        createdAt: serverTimestamp(),
      };

      if (isEdit) {
        const snap = await getDocs(
          query(txCol, where('splitId', '==', splitId)),
        );
        if (!snap.empty) {
          const oldAmount = parseFloat(snap.docs[0].data().amount || '0');
          const delta = oldAmount - amount;
          await updateDoc(snap.docs[0].ref, txData);
          if (Math.abs(delta) > 0.001) {
            await updateDoc(userRef, {
              balance: increment(delta),
            });
          } else {
          }
        } else {
          await addDoc(txCol, txData);
          await updateDoc(userRef, {
            balance: increment(-amount),
          });
        }
      } else {
        await addDoc(txCol, txData);
        await updateDoc(userRef, {
          balance: increment(-amount),
        });
      }
    } catch (e) {
      reportError(e as Error);
    }
  };

  const uploadReceiptImage = async (): Promise<string | null> => {
    if (!receiptImage) {
      return null;
    }
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      return null;
    }
    const path = `bills/${currentUser.uid}/${Date.now()}-split-receipt.jpg`;
    const ref = createStorageRef(getStorage(), path);
    const stopTrace = await PerformanceService.traceUploadReceipt();
    await putFile(ref, receiptImage);
    await stopTrace?.();
    return await getDownloadURL(ref);
  };

  const takePhotoFromCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return;
    }
    launchCamera(
      {mediaType: 'photo', includeBase64: false, quality: 0.8},
      response => {
        if (!response.didCancel && !response.errorCode) {
          setReceiptImage(response.assets![0].uri!);
        }
      },
    );
    setImageModalVisible(false);
  };

  const choosePhotoFromLibrary = () => {
    launchImageLibrary(
      {mediaType: 'photo', includeBase64: false, quality: 0.8},
      response => {
        if (!response.didCancel && !response.errorCode) {
          setReceiptImage(response.assets![0].uri!);
        }
      },
    );
    setImageModalVisible(false);
  };

  const renderSplitTypeButtons = () => (
    <View style={styles.splitTypeButtons}>
      <TouchableOpacity
        style={[
          styles.splitTypeButton,
          splitType === 'equal' && styles.splitTypeButtonActive,
        ]}
        onPress={() => setSplitType('equal')}>
        <Text
          style={[
            styles.splitTypeButtonText,
            splitType === 'equal' && styles.splitTypeButtonTextActive,
          ]}>
          Equal Split
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.splitTypeButton,
          splitType === 'percentage' && styles.splitTypeButtonActive,
        ]}
        onPress={() => setSplitType('percentage')}>
        <Text
          style={[
            styles.splitTypeButtonText,
            splitType === 'percentage' && styles.splitTypeButtonTextActive,
          ]}>
          Percentage Split
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderMemberCheckbox = (member: GroupMember) => {
    const currentUser = getAuth().currentUser;
    const isCurrentUser = member.email === currentUser?.email;
    const isSelected = selectedUsers[member.email];

    const handleCardPress = () => {
      if (isCurrentUser && !isSelected) {
        Alert.alert(
          'Cannot Add Yourself',
          'You cannot add yourself to the split. You are the one creating/paying for this expense.',
        );
        return;
      }
      const selectedCount = Object.values(selectedUsers).filter(Boolean).length;
      if (!isSelected || selectedCount > 1) {
        toggleUserSelection(member.email);
      } else {
        Alert.alert(
          'Error',
          'At least one person must be included in the split.',
        );
      }
    };

    return (
      <TouchableOpacity
        key={member.email}
        activeOpacity={0.7}
        onPress={handleCardPress}>
        <Card
          style={[
            styles.memberCard,
            isSelected && styles.memberCardSelected,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : isSelected ? 2 : 1}>
          <View style={styles.memberCheckboxContainer}>
            <View style={styles.memberInfo}>
              <View style={styles.memberNameContainer}>
                {Platform.OS === 'ios' ? (
                  <View
                    style={[
                      styles.customCheckboxIOS,
                      isSelected && styles.customCheckboxIOSSelected,
                    ]}>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                ) : (
                  <Checkbox
                    status={isSelected ? 'checked' : 'unchecked'}
                    color={PRIMARY_COLOR}
                  />
                )}
                <Text style={styles.memberName}>
                  {member.name}
                  {isCurrentUser && ' (You)'}
                </Text>
              </View>
              {splitType === 'percentage' && isSelected && (
                <TouchableOpacity
                  style={styles.percentageInputContainer}
                  activeOpacity={1}
                  onPress={e => e.stopPropagation()}>
                  <TextInput
                    style={styles.percentageInput}
                    keyboardType="numeric"
                    value={selectedPercentages[member.email]}
                    onChangeText={text => updatePercentages(member.email, text)}
                    placeholder="0"
                    onFocus={e => e.stopPropagation()}
                  />
                  <Text style={styles.percentageSymbol}>%</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading group members...</Text>
      </View>
    );
  }

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
                name="cash-multiple"
                size={32}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.headerTitle}>
                {isEditMode ? 'Edit Split' : 'Create Split'}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {isEditMode
                ? 'Update expense details'
                : 'Split expenses with your group'}
            </Text>
          </View>

          <Card
            style={[
              styles.formCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Split Title</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter split title"
                  value={title}
                  onChangeText={setTitle}
                  placeholderTextColor="#999"
                  maxLength={100}
                />
                <Text style={styles.characterCount}>{title.length}/100</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Amount ({(currency as any).symbol})
                </Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>
                    {(currency as any).symbol}
                  </Text>
                  <TextInput
                    style={styles.textInputAmount}
                    placeholder="Enter total amount"
                    keyboardType="numeric"
                    value={formatInputAmount(amount)}
                    onChangeText={text => setAmount(text.replace(/,/g, ''))}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setDatePickerVisible(true)}>
                  <Text style={styles.dateText}>
                    {date.toLocaleDateString()}
                  </Text>
                  <MaterialCommunityIcons
                    name="calendar"
                    size={20}
                    color={PRIMARY_COLOR}
                  />
                </TouchableOpacity>
                <DatePickerModal
                  locale="en"
                  mode="single"
                  visible={datePickerVisible}
                  onDismiss={onDismissDatePicker}
                  date={date}
                  onConfirm={onConfirmDate as any}
                  saveLabel="Confirm"
                  label="Select date"
                  uppercase={false}
                  {...(Platform.OS === 'ios' && {
                    presentationStyle: 'pageSheet',
                  })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <TouchableOpacity
                  style={styles.categorySelectorButton}
                  onPress={() => setCategoryModalVisible(true)}>
                  {category ? (
                    <>
                      <MaterialCommunityIcons
                        name={getCategoryIcon(category)}
                        size={20}
                        color={PRIMARY_COLOR}
                      />
                      <Text style={styles.categorySelectorText}>
                        {getCategoryLabel(category, 'split')}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.categorySelectorPlaceholder}>
                      Select category
                    </Text>
                  )}
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  placeholder="Add a note..."
                  value={notes}
                  onChangeText={setNotes}
                  placeholderTextColor="#999"
                  multiline
                  maxLength={200}
                  numberOfLines={3}
                />
                <Text style={styles.characterCount}>{notes.length}/200</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Receipt (Optional)</Text>
                {receiptImage ? (
                  <View style={styles.receiptPreviewContainer}>
                    <Image
                      source={{uri: receiptImage}}
                      style={styles.receiptPreview}
                    />
                    <View style={styles.receiptActions}>
                      <TouchableOpacity
                        style={styles.receiptActionBtn}
                        onPress={() => setImageModalVisible(true)}>
                        <MaterialCommunityIcons
                          name="camera-switch"
                          size={18}
                          color={PRIMARY_COLOR}
                        />
                        <Text style={styles.receiptActionText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.receiptActionBtn, styles.removeBtn]}
                        onPress={() => setReceiptImage(null)}>
                        <MaterialCommunityIcons
                          name="delete"
                          size={18}
                          color="#F64E4E"
                        />
                        <Text
                          style={[
                            styles.receiptActionText,
                            {color: '#F64E4E'},
                          ]}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.receiptUploadBtn}
                    onPress={() => setImageModalVisible(true)}>
                    <MaterialCommunityIcons
                      name="camera-plus"
                      size={28}
                      color={PRIMARY_COLOR}
                    />
                    <Text style={styles.receiptUploadText}>Attach Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.recurringRow}>
                  <View>
                    <Text style={styles.inputLabel}>Recurring Split</Text>
                    <Text style={styles.recurringSubtext}>
                      Auto-create this split on a schedule
                    </Text>
                  </View>
                  <Switch
                    value={recurringEnabled}
                    onValueChange={setRecurringEnabled}
                    color={PRIMARY_COLOR}
                  />
                </View>
                {recurringEnabled && (
                  <View style={styles.frequencyRow}>
                    <TouchableOpacity
                      style={[
                        styles.freqBtn,
                        recurringFrequency === 'weekly' && styles.freqBtnActive,
                      ]}
                      onPress={() => setRecurringFrequency('weekly')}>
                      <Text
                        style={[
                          styles.freqBtnText,
                          recurringFrequency === 'weekly' &&
                            styles.freqBtnTextActive,
                        ]}>
                        Weekly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.freqBtn,
                        recurringFrequency === 'monthly' &&
                          styles.freqBtnActive,
                      ]}
                      onPress={() => setRecurringFrequency('monthly')}>
                      <Text
                        style={[
                          styles.freqBtnText,
                          recurringFrequency === 'monthly' &&
                            styles.freqBtnTextActive,
                        ]}>
                        Monthly
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.recurringRow}>
                  <View>
                    <Text style={styles.inputLabel}>
                      Add to my transactions
                    </Text>
                    <Text style={styles.recurringSubtext}>
                      Record your share as a personal expense
                    </Text>
                  </View>
                  <Switch
                    value={includeInTransactions}
                    onValueChange={setIncludeInTransactions}
                    color={PRIMARY_COLOR}
                  />
                </View>
              </View>
            </View>
          </Card>

          <Card
            style={[
              styles.sectionCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Paid By</Text>
              <View style={styles.paidByContainer}>
                {groupMembers.map(member => (
                  <TouchableOpacity
                    key={member.email}
                    style={[
                      styles.paidByOption,
                      paidBy?.email === member.email &&
                        styles.selectedPaidByOption,
                    ]}
                    onPress={() => setPaidBy(member)}>
                    <Text
                      style={[
                        styles.paidByText,
                        paidBy?.email === member.email &&
                          styles.selectedPaidByText,
                      ]}>
                      {member.name}
                      {member.email === getAuth().currentUser?.email &&
                        ' (You)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>

          <Card
            style={[
              styles.sectionCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Split Type</Text>
              {renderSplitTypeButtons()}
            </View>
          </Card>

          <Card
            style={[
              styles.sectionCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <View style={styles.splitWithHeader}>
                <Text style={styles.sectionTitle}>Split With</Text>
                {splitType === 'percentage' && (
                  <Text style={styles.percentageNote}>
                    Total:{' '}
                    {Object.entries(selectedUsers)
                      .filter(([, isSelected]) => isSelected)
                      .reduce(
                        (sum, [email]) =>
                          sum + parseFloat(selectedPercentages[email] || '0'),
                        0,
                      )
                      .toFixed(2)}
                    %
                  </Text>
                )}
              </View>
              {groupMembers.map(renderMemberCheckbox)}
            </View>
          </Card>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}>
              <Text style={styles.submitButtonText}>
                {isEditMode ? 'Update Split' : 'Create Split'}
              </Text>
              <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Modal
            visible={categoryModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setCategoryModalVisible(false)}>
            <TouchableOpacity
              style={styles.categoryModalOverlay}
              activeOpacity={1}
              onPress={() => setCategoryModalVisible(false)}>
              <View style={styles.categoryModalSheet}>
                <View style={styles.categoryModalHeader}>
                  <Text style={styles.categoryModalTitle}>Select Category</Text>
                  <TouchableOpacity
                    onPress={() => setCategoryModalVisible(false)}>
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.categoryGrid}>
                  {SPLIT_CATEGORIES.map((cat: any) => {
                    const isSelected = category === cat.value;
                    return (
                      <TouchableOpacity
                        key={cat.value}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                        ]}
                        onPress={() => {
                          setCategory(cat.value);
                          setCategoryModalVisible(false);
                        }}>
                        <MaterialCommunityIcons
                          name={cat.icon}
                          size={22}
                          color={isSelected ? '#FFFFFF' : PRIMARY_COLOR}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          <Modal
            visible={imageModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setImageModalVisible(false)}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setImageModalVisible(false)}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Add Receipt Photo</Text>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={takePhotoFromCamera}>
                  <MaterialCommunityIcons
                    name="camera"
                    size={24}
                    color={PRIMARY_COLOR}
                  />
                  <Text style={styles.modalOptionText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={choosePhotoFromLibrary}>
                  <MaterialCommunityIcons
                    name="image"
                    size={24}
                    color={PRIMARY_COLOR}
                  />
                  <Text style={styles.modalOptionText}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setImageModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingText: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginTop: 15,
    fontFamily: 'Lato-Regular',
  },
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
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 15,
  },
  cardContent: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 8,
    fontFamily: 'Lato-Bold',
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginRight: 12,
    fontFamily: 'Lato-Bold',
  },
  textInputAmount: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  // last definition wins for dateInput (overrides earlier declaration)
  dateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Lato-Bold',
  },
  paidByContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paidByOption: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EBF7',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedPaidByOption: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  paidByText: {
    fontSize: 14,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  selectedPaidByText: {
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
  },
  memberCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  memberCardSelected: {
    borderWidth: 1,
    borderColor: PRIMARY_COLOR + '30',
  },
  memberCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customCheckboxIOS: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#999',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  customCheckboxIOSSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  memberName: {
    fontSize: 16,
    color: '#3A3B3E',
    flex: 1,
  },
  percentageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  // last definition wins for percentageInput (overrides earlier declaration)
  percentageInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 5,
    width: 70,
    padding: 5,
    marginLeft: 10,
    textAlign: 'center',
  },
  percentageSymbol: {
    marginLeft: 4,
    color: '#666',
    fontSize: 16,
  },
  percentageNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'right',
  },
  // last definition wins for dropdown
  dropdown: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
    marginVertical: 10,
    borderRadius: 10,
  },
  // last definition wins for dropdownContainer
  dropdownContainer: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  // last definition wins for categoryIcon
  categoryIcon: {
    marginRight: 10,
  },
  splitTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitTypeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  splitTypeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  splitTypeButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  splitTypeButtonText: {
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  splitTypeButtonTextActive: {
    color: '#fff',
  },
  splitWithHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    fontFamily: 'Lato-Bold',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
    fontFamily: 'Lato-Regular',
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  cardAndroid: {
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  receiptPreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E4F0',
  },
  receiptPreview: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  receiptActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
    backgroundColor: '#F9FAFF',
  },
  receiptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  receiptActionText: {
    fontSize: 13,
    color: '#677CD2',
    fontFamily: 'Lato-Regular',
  },
  removeBtn: {},
  receiptUploadBtn: {
    borderWidth: 1,
    borderColor: '#E0E4F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F9FAFF',
    gap: 6,
  },
  receiptUploadText: {
    fontSize: 14,
    color: '#677CD2',
    fontFamily: 'Lato-Regular',
  },
  recurringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurringSubtext: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Lato-Regular',
    marginTop: 2,
  },
  frequencyRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#EEF0FB',
  },
  freqBtnActive: {
    backgroundColor: '#677CD2',
  },
  freqBtnText: {
    fontSize: 14,
    color: '#677CD2',
    fontFamily: 'Lato-Bold',
  },
  freqBtnTextActive: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#F64E4E',
    fontFamily: 'Lato-Bold',
  },
  categorySelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 14,
    gap: 10,
  },
  categorySelectorText: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  categorySelectorPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#999',
    fontFamily: 'Lato-Regular',
  },
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  categoryModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  categoryChipSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#555',
    marginTop: 5,
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
  },
});

export default CreateSplitScreen;
