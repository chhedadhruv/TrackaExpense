import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {useRouter} from 'expo-router';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
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
import {
  pickImageFromCamera,
  pickImageFromLibrary,
} from '../../src/utils/imagePicker';
import {ActivityIndicator} from 'react-native';
import Card from '../../src/components/Card';
import TickBox from '../../src/components/TickBox';
import Toggle from '../../src/components/Toggle';
import CardField from '../../src/components/form/CardField';
import {useCards} from '../../src/hooks/useCards';
import {cardIdOf} from '../../src/utils/cards';
import {getConfig} from '../../src/services/RemoteConfigService';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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
import {useAsyncAction} from '../../src/hooks/useAsyncAction';
import * as PerformanceService from '../../src/services/PerformanceService';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import DatePickerModal from '../../src/components/DatePickerModal';
import Calendar from 'lucide-react-native/icons/calendar';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import Coins from 'lucide-react-native/icons/coins';
import ImageIcon from 'lucide-react-native/icons/image';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Trash2 from 'lucide-react-native/icons/trash-2';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import SplitNotificationService from '../../services/SplitNotificationService';
import {useCurrency} from '../../utils/CurrencyUtil';
import {
  SPLIT_CATEGORIES,
  SPLIT_KEYWORD_MAP,
  SPLIT_VALUES,
} from '../../utils/CategoryData';
import CategorySelector from '../../src/components/CategorySelector';
import {useCategorySuggestion} from '../../src/hooks/useCategorySuggestion';
import {
  useTitleIndex,
  useTitleSuggestions,
} from '../../src/hooks/useTitleSuggestions';
import TitleSuggestions from '../../src/components/form/TitleSuggestions';
import {buildCategoryHistory} from '../../src/utils/categorySuggest';
import {splitsAsHistory} from '../../src/utils/titleSuggest';
import {useGroupSplits} from '../../src/data/split';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {formatInputAmount} from '../../src/utils/formatters';
import {
  balanceEffect,
  editBalanceDelta,
  transactionMoneyFields,
} from '../../src/utils/amounts';
import {tryToMinor} from '../../src/utils/money';
import {lookupUsersByEmail} from '../../src/services/UserLookup';
import {snackbar} from '../../src/utils/snackbarStore';
import {ModalSnackbar} from '../../src/components/Snackbar';

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
  /** Integer minor units of `amount` (the exact value); see src/utils/amounts.ts. */
  amountMinor?: number;
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

export interface CreateSplitScreenProps {
  group: Group;
  /** Present when an existing split is being edited. */
  split?: ExistingSplit;
}

const CreateSplitScreen = ({group, split}: CreateSplitScreenProps) => {
  const {currency} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [isSplitByPercentage, setIsSplitByPercentage] = useState(false);
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
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [date, setDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] =
    useState<RecurringFrequency>('monthly');
  const [includeInTransactions, setIncludeInTransactions] = useState(true);
  const isEditMode = !!split;

  // "Paid with": a card for the payer's own entry in their transactions. It starts on Cash / UPI,
  // and a card purchase does not change the balance until the card bill is paid. Other members'
  // shares and balances are not affected.
  const cardsEnabled = getConfig().enable_cards;
  const cards = useCards().data;
  const pickableCards = (cards ?? []).filter(
    c => !c.archived || c.id === cardId,
  );
  const [cardId, setCardId] = useState<string | null>(null);

  // Editing: show the card the payer's own entry already has.
  useEffect(() => {
    if (!isEditMode || !split || !cardsEnabled) {
      return;
    }
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    let active = true;
    getDocs(
      query(
        collection(getFirestore(), 'users', uid, 'transactions'),
        where('splitId', '==', split.id),
      ),
    )
      .then(snap => {
        const existing = snap.docs[0]?.data();
        if (active && existing) {
          setCardId(cardIdOf(existing));
        }
      })
      .catch(e => reportError(e as Error));
    return () => {
      active = false;
    };
  }, [isEditMode, split, cardsEnabled]);

  useEffect(() => {
    if (!group || !group.id) {
      snackbar.error('Group information is missing');
      router.back();
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
      const found = await lookupUsersByEmail(membersData);
      const formattedMembers: GroupMember[] = membersData.map((email, i) => {
        const match = found[i];
        return match
          ? {
              email,
              name: match.name || email.split('@')[0],
              userId: match.uid,
              avatar: match.avatar,
            }
          : {email, name: email.split('@')[0], userId: null};
      });

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
      snackbar.error('Failed to load group members');
      router.back();
    }
  };

  useEffect(() => {
    setIsSplitByPercentage(splitType === 'percentage');
  }, [splitType]);

  // Suggestions learn from this group's own splits (already cached for the group screen), then the
  // split keyword map. An edited split's category was chosen before, so the guess never replaces it.
  const groupSplits = useGroupSplits(group?.id).data;
  const splitHistorySource = useMemo(
    () => (groupSplits ? splitsAsHistory(groupSplits) : undefined),
    [groupSplits],
  );
  const splitCategoryHistory = useMemo(
    () =>
      splitHistorySource
        ? buildCategoryHistory(splitHistorySource, 'expense', SPLIT_VALUES)
        : undefined,
    [splitHistorySource],
  );
  const setSplitCategory = useCallback(
    (value: string) => setCategory(value === '' ? null : value),
    [],
  );
  const categorySuggestion = useCategorySuggestion({
    title,
    category: category ?? '',
    setCategory: setSplitCategory,
    allowed: SPLIT_VALUES,
    keywordMap: SPLIT_KEYWORD_MAP,
    history: splitCategoryHistory,
    startPickedByHand: isEditMode,
  });
  const splitTitleIndex = useTitleIndex(
    splitHistorySource,
    'expense',
    SPLIT_VALUES,
  );
  const titleSuggestions = useTitleSuggestions({
    index: splitTitleIndex,
    title,
    setTitle,
    onCategory: categorySuggestion.applyGuess,
  });

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
      snackbar.error('At least one person must be included in the split.');
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

  const saveSplit = async () => {
    if (!title) {
      snackbar.error('Please enter a split title');
      return;
    }
    if (title.trim().length > 100) {
      snackbar.error('Title must be 100 characters or less');
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      snackbar.error('Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) <= 0) {
      snackbar.error('Amount must be greater than 0');
      return;
    }
    if (parseFloat(amount) > 999999999) {
      snackbar.error('Amount must be less than 999,999,999');
      return;
    }
    if (!paidBy) {
      snackbar.error('Please select who paid for this split');
      return;
    }
    if (!category) {
      snackbar.error('Please select a category');
      return;
    }

    const selectedUsersList = Object.entries(selectedUsers)
      .filter(([, isSelected]) => isSelected)
      .map(([email]) => groupMembers.find(member => member.email === email))
      .filter((m): m is GroupMember => !!m);

    if (selectedUsersList.length === 0) {
      snackbar.error('Please select at least one user to split with');
      return;
    }

    if (isSplitByPercentage) {
      const percentageTotal = selectedUsersList.reduce((total, user) => {
        return total + parseFloat(selectedPercentages[user.email] || '0');
      }, 0);
      if (percentageTotal !== 100) {
        snackbar.error('Total percentage must equal 100% for selected users');
        return;
      }
    }

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
      const splitMinor = tryToMinor(amount, (currency as any).code || 'INR');
      const splitDate = Timestamp.fromDate(date);
      const splitData: SplitData = {
        title,
        amount: splitAmount,
        // Omitted (never undefined) when the typed amount cannot be converted.
        ...(splitMinor === null ? {} : {amountMinor: splitMinor}),
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
      // Back to the group, which reads its splits again each time it comes into focus.
      if (isEditMode) {
        snackbar.success('Split updated successfully');
        router.back();
      } else {
        router.back();
        snackbar.success('Split added successfully');
      }
    } catch (error) {
      reportError(error as Error);
      snackbar.error(
        `Failed to ${
          isEditMode ? 'update' : 'create'
        } split. Please try again.`,
      );
    }
  };
  const {run: handleSubmit, pending: submitting} = useAsyncAction(saveSplit);

  const writeSplitTransaction = async (
    splitId: string,
    splitAmount: number,
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
      // The payer's own transaction keeps the legacy two-decimal string; the balance follows that
      // same rounded amount so adding, editing and removing it cancel exactly.
      const txAmount = String(parseFloat(splitAmount.toFixed(2)));
      const currencyCode = (currency as any).code || 'INR';

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
                    amount: txAmount,
                    ...transactionMoneyFields(txAmount, currencyCode),
                    date: dateStr,
                    source: 'split',
                    splitId,
                    groupId: group.id,
                    groupName: group.name,
                    splitRole: 'payer',
                  },
                  balanceDelta: balanceEffect(
                    'expense',
                    {amount: txAmount},
                    currencyCode,
                  ),
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
            // Removing the payer's transaction reverses what it did to the balance.
            const reversal = -balanceEffect(
              'expense',
              snap.docs[0].data(),
              currencyCode,
            );
            await deleteDoc(snap.docs[0].ref);
            if (reversal > 0) {
              await updateDoc(userRef, {
                balance: increment(reversal),
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
        amount: txAmount,
        ...transactionMoneyFields(txAmount, currencyCode),
        date: dateStr,
        source: 'split',
        splitId,
        groupId: group.id,
        groupName: group.name,
        splitRole: 'payer',
        createdAt: serverTimestamp(),
        // Only written for a card; an edit sets or clears it below.
        ...(cardsEnabled && cardId !== null ? {cardId} : {}),
      };

      if (isEdit) {
        const snap = await getDocs(
          query(txCol, where('splitId', '==', splitId)),
        );
        if (!snap.empty) {
          const existing = snap.docs[0].data();
          // Exact integer math first; the old float subtraction only if an amount cannot be
          // converted to minor units.
          // The card after this edit: the form's choice while cards are on, otherwise what the
          // entry already had (an edit never changes a card it did not show).
          const newCard = cardsEnabled ? cardId : cardIdOf(existing);
          const delta =
            editBalanceDelta(
              existing,
              'expense',
              txAmount,
              currencyCode,
              newCard,
            ) ??
            (cardIdOf(existing) !== null || newCard !== null
              ? 0
              : parseFloat(existing.amount || '0') - splitAmount);
          await updateDoc(snap.docs[0].ref, {
            ...txData,
            ...(cardsEnabled ? {cardId: newCard ?? deleteField()} : {}),
          });
          if (Math.abs(delta) > 0.001) {
            await updateDoc(userRef, {
              balance: increment(delta),
            });
          } else {
          }
        } else {
          await addDoc(txCol, txData);
          await updateDoc(userRef, {
            balance: increment(
              balanceEffect(
                'expense',
                {amount: txAmount, cardId: cardsEnabled ? cardId : null},
                currencyCode,
              ),
            ),
          });
        }
      } else {
        await addDoc(txCol, txData);
        await updateDoc(userRef, {
          balance: increment(
            balanceEffect(
              'expense',
              {amount: txAmount, cardId: cardsEnabled ? cardId : null},
              currencyCode,
            ),
          ),
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
    setImageModalVisible(false);
    const uri = await pickImageFromCamera();
    if (uri) {
      setReceiptImage(uri);
    }
  };

  const choosePhotoFromLibrary = async () => {
    setImageModalVisible(false);
    const uri = await pickImageFromLibrary();
    if (uri) {
      setReceiptImage(uri);
    }
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
        snackbar.error(
          'You cannot add yourself to the split. You are the one creating/paying for this expense.',
        );
        return;
      }
      const selectedCount = Object.values(selectedUsers).filter(Boolean).length;
      if (!isSelected || selectedCount > 1) {
        toggleUserSelection(member.email);
      } else {
        snackbar.error('At least one person must be included in the split.');
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
                <TickBox selected={isSelected} />
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
                    placeholderTextColor={colors.textPlaceholder}
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
        <ActivityIndicator size="large" color={colors.primary} />
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
              <Coins size={32} color={colors.primary} />
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
                  onFocus={titleSuggestions.onFocus}
                  onBlur={titleSuggestions.onBlur}
                  placeholderTextColor={colors.textPlaceholder}
                  maxLength={100}
                />
                <TitleSuggestions
                  suggestions={titleSuggestions.suggestions}
                  onPick={titleSuggestions.pick}
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
                    placeholderTextColor={colors.textPlaceholder}
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
                  <Calendar size={20} color={colors.primary} />
                </TouchableOpacity>
                <DatePickerModal
                  visible={datePickerVisible}
                  onDismiss={onDismissDatePicker}
                  date={date}
                  onConfirm={onConfirmDate}
                  label="Select date"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <CategorySelector
                  categories={SPLIT_CATEGORIES}
                  selectedCategory={category ?? ''}
                  onSelect={categorySuggestion.pickByHand}
                  suggested={categorySuggestion.suggested}
                  guessed={categorySuggestion.guessed}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  placeholder="Add a note..."
                  value={notes}
                  onChangeText={setNotes}
                  placeholderTextColor={colors.textPlaceholder}
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
                        <RefreshCw size={18} color={colors.primary} />
                        <Text style={styles.receiptActionText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.receiptActionBtn, styles.removeBtn]}
                        onPress={() => setReceiptImage(null)}>
                        <Trash2 size={18} color={colors.expense} />
                        <Text
                          style={[
                            styles.receiptActionText,
                            styles.removeActionText,
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
                    <ImagePlus size={28} color={colors.primary} />
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
                  <Toggle
                    value={recurringEnabled}
                    onValueChange={setRecurringEnabled}
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
                  <Toggle
                    value={includeInTransactions}
                    onValueChange={setIncludeInTransactions}
                  />
                </View>
              </View>

              {cardsEnabled &&
              includeInTransactions &&
              pickableCards.length > 0 &&
              paidBy?.email?.toLowerCase() ===
                getAuth().currentUser?.email?.toLowerCase() ? (
                <View style={styles.inputContainer}>
                  <CardField
                    cards={pickableCards}
                    value={cardId}
                    onChange={setCardId}
                    disabled={submitting}
                  />
                </View>
              ) : null}
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
              style={[styles.submitButton, submitting && styles.submitBusy]}
              onPress={handleSubmit}
              accessibilityState={{disabled: submitting, busy: submitting}}
              disabled={loading || submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    {isEditMode ? 'Update Split' : 'Create Split'}
                  </Text>
                  <Check size={20} color={colors.onPrimary} />
                </>
              )}
            </TouchableOpacity>
          </View>

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
                  <Camera size={24} color={colors.primary} />
                  <Text style={styles.modalOptionText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={choosePhotoFromLibrary}>
                  <ImageIcon size={24} color={colors.primary} />
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
            <ModalSnackbar />
          </Modal>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      fontSize: 16,
      color: colors.primary,
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
    sectionCard: {
      backgroundColor: colors.surface,
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
      color: colors.textStrong,
      marginBottom: 8,
      fontFamily: 'Lato-Bold',
    },
    textInput: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 15,
      paddingVertical: 12,
    },
    currencySymbol: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      marginRight: 12,
      fontFamily: 'Lato-Bold',
    },
    textInputAmount: {
      flex: 1,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    // last definition wins for dateInput (overrides earlier declaration)
    dateInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateText: {
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 15,
      fontFamily: 'Lato-Bold',
    },
    paidByContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    paidByOption: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 10,
      marginRight: 10,
      marginBottom: 10,
    },
    selectedPaidByOption: {
      backgroundColor: colors.primaryFill,
      borderColor: colors.primaryFill,
    },
    paidByText: {
      fontSize: 14,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    selectedPaidByText: {
      color: colors.onPrimary,
      fontFamily: 'Lato-Bold',
    },
    memberCard: {
      marginBottom: 10,
      backgroundColor: colors.surface,
      borderRadius: 12,
      elevation: Platform.OS === 'android' ? 0 : 1,
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    memberCardSelected: {
      borderWidth: 1,
      borderColor: colors.primarySoft,
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
    memberName: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    percentageInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      marginTop: 8,
      paddingHorizontal: 12,
      height: 40,
    },
    // last definition wins for percentageInput (overrides earlier declaration)
    percentageInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      width: 70,
      padding: 5,
      marginLeft: 10,
      textAlign: 'center',
      color: colors.textStrong,
    },
    percentageSymbol: {
      marginLeft: 4,
      color: colors.textSecondary,
      fontSize: 16,
    },
    percentageNote: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 10,
      textAlign: 'right',
    },
    // last definition wins for dropdown
    dropdown: {
      borderColor: colors.primary,
      borderWidth: 1,
      marginVertical: 10,
      borderRadius: 10,
    },
    // last definition wins for dropdownContainer
    dropdownContainer: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
    },
    splitTypeButtonActive: {
      backgroundColor: colors.primaryFill,
    },
    splitTypeButtonText: {
      color: colors.primary,
      fontWeight: '500',
    },
    splitTypeButtonTextActive: {
      color: colors.onPrimary,
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
      backgroundColor: colors.primaryFill,
      paddingVertical: 15,
      borderRadius: 12,
      elevation: Platform.OS === 'android' ? 0 : 1,
      shadowColor: colors.primaryFill,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.15,
      shadowRadius: 2,
    },
    submitBusy: {
      opacity: 0.7,
    },
    submitButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginRight: 8,
      fontFamily: 'Lato-Bold',
    },
    characterCount: {
      fontSize: 12,
      color: colors.textPlaceholder,
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
      borderColor: colors.cardBorder,
    },
    receiptPreviewContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surfaceMuted,
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
      color: colors.primary,
      fontFamily: 'Lato-Regular',
    },
    removeBtn: {},
    removeActionText: {color: colors.expenseText},
    receiptUploadBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      backgroundColor: colors.surfaceMuted,
      gap: 6,
    },
    receiptUploadText: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: 'Lato-Regular',
    },
    recurringRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    recurringSubtext: {
      fontSize: 12,
      color: colors.textMuted,
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
      backgroundColor: colors.primarySoft,
    },
    freqBtnActive: {
      backgroundColor: colors.primaryFill,
    },
    freqBtnText: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: 'Lato-Bold',
    },
    freqBtnTextActive: {
      color: colors.onPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
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
      borderBottomColor: colors.divider,
    },
    modalOptionText: {
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    modalCancel: {
      alignItems: 'center',
      paddingVertical: 16,
      marginTop: 8,
    },
    modalCancelText: {
      fontSize: 16,
      color: colors.expenseText,
      fontFamily: 'Lato-Bold',
    },
  });

export default CreateSplitScreen;
