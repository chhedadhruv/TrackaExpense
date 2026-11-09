import React, {useState, useEffect} from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import {Text, Checkbox, Card, ActivityIndicator} from 'react-native-paper';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc as fsDoc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query as fsQuery,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import type {DocumentData} from '@react-native-firebase/firestore';
import {planGroupEdit} from '../../src/utils/groupEdit';
import {
  lookupUserByEmail,
  lookupUserByPhone,
  lookupUsersByEmail,
} from '../../src/services/UserLookup';
import {getAuth} from '@react-native-firebase/auth';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import UserAvatar from '../../src/components/Avatar';
import SelectModal from '../../src/components/SelectModal';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import SplitNotificationService from '../../services/SplitNotificationService';
import ReminderNotificationService from '../../services/ReminderNotificationService';
import {getConfig} from '../../src/services/RemoteConfigService';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../../src/constants/theme';
import type {McIconName} from '../../src/types/icons';

interface UserDetail {
  email: string;
  name?: string | null;
  displayName?: string;
  userId?: string;
  [key: string]: unknown;
}

interface Group {
  id: string;
  name: string;
  category?: string | null;
  members: string[];
  memberDetails: UserDetail[];
  memberNames?: Record<string, string>;
  pendingInvites?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

const GROUP_CATEGORIES = [
  {
    label: 'Work',
    value: 'Work',
    icon: () => (
      <MaterialCommunityIcons
        name="briefcase"
        size={24}
        color={PRIMARY_COLOR}
      />
    ),
  },
  {
    label: 'Family',
    value: 'Family',
    icon: () => (
      <MaterialCommunityIcons
        name="home-heart"
        size={24}
        color={PRIMARY_COLOR}
      />
    ),
  },
  {
    label: 'Couple',
    value: 'Couple',
    icon: () => (
      <MaterialCommunityIcons
        name="heart-multiple"
        size={24}
        color={PRIMARY_COLOR}
      />
    ),
  },
  {
    label: 'Friends',
    value: 'Friends',
    icon: () => (
      <MaterialCommunityIcons
        name="account-group"
        size={24}
        color={PRIMARY_COLOR}
      />
    ),
  },
  {
    label: 'Travel',
    value: 'Travel',
    icon: () => (
      <MaterialCommunityIcons name="airplane" size={24} color={PRIMARY_COLOR} />
    ),
  },
  {
    label: 'Sports',
    value: 'Sports',
    icon: () => (
      <MaterialCommunityIcons
        name="basketball"
        size={24}
        color={PRIMARY_COLOR}
      />
    ),
  },
  {
    label: 'Hobby',
    value: 'Hobby',
    icon: () => (
      <MaterialCommunityIcons name="palette" size={24} color={PRIMARY_COLOR} />
    ),
  },
  {
    label: 'Study',
    value: 'Study',
    icon: () => (
      <MaterialCommunityIcons
        name="book-open-variant"
        size={24}
        color={PRIMARY_COLOR}
      />
    ),
  },
  {
    label: 'Other',
    value: 'Other',
    icon: () => (
      <MaterialCommunityIcons
        name="dots-horizontal-circle"
        size={24}
        color={PRIMARY_COLOR}
      />
    ),
  },
];

const getCategoryIcon = (value: string): McIconName => {
  const map: Record<string, McIconName> = {
    Work: 'briefcase',
    Family: 'home-heart',
    Couple: 'heart-multiple',
    Friends: 'account-group',
    Travel: 'airplane',
    Sports: 'basketball',
    Hobby: 'palette',
    Study: 'book-open-variant',
    Other: 'dots-horizontal-circle',
  };
  return map[value] || 'account-group';
};

const SplitScreen = ({navigation, route}: {navigation: any; route: any}) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDetails, setUserDetails] = useState<UserDetail | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<UserDetail[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_unregisteredName, setUnregisteredName] = useState('');
  const [_splitHistory, setSplitHistory] = useState<object[]>([]);
  const [invitationsCount, setInvitationsCount] = useState(0);
  const currentUser = getAuth().currentUser;

  const fetchGroups = async () => {
    try {
      setLoading(true);
      if (!currentUser) {
        return;
      }
      const groupSnapshot = await getDocs(
        fsQuery(
          collection(getFirestore(), 'groups'),
          where('members', 'array-contains', currentUser.email),
        ),
      );
      // One lookup for every member of every group, instead of one profile read per member.
      const allEmails: string[] = [
        ...new Set<string>(
          groupSnapshot.docs.flatMap(d => (d.data().members as string[]) || []),
        ),
      ];
      const foundList = await lookupUsersByEmail(allEmails);
      const foundByEmail = new Map(
        allEmails.map((email, i) => [email, foundList[i]] as const),
      );
      const fetchedGroups = groupSnapshot.docs.map(doc => {
        const groupData = doc.data();
        const memberDetails: UserDetail[] = (groupData.members || []).map(
          (email: string) => {
            const match = foundByEmail.get(email);
            return match
              ? {
                  email,
                  name: match.name || groupData.memberNames?.[email] || null,
                  avatar: match.avatar,
                  userId: match.uid,
                }
              : {email, name: groupData.memberNames?.[email] || null};
          },
        );
        return {id: doc.id, ...groupData, memberDetails} as Group;
      });
      setGroups(fetchedGroups);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchGroups();
      ReminderNotificationService.processRecurringSplits().catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]),
  );

  useEffect(() => {
    if (!currentUser?.email) {
      return;
    }
    const unsub = onSnapshot(
      fsQuery(
        collection(getFirestore(), 'invitations'),
        where('email', '==', currentUser.email),
        where('status', '==', 'pending'),
      ),
      snapshot => {
        setInvitationsCount(snapshot.size);
      },
      () => {},
    );
    return () => unsub && unsub();
  }, [currentUser?.email]);

  useEffect(() => {
    if (route?.params?.editGroupId && groups.length > 0) {
      const target = groups.find(g => g.id === route.params.editGroupId);
      if (target) {
        handleEditGroup(target);
        navigation.setParams({editGroupId: undefined});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.editGroupId, groups]);

  useEffect(() => {
    if (route?.params?.editGroup && groups.length > 0) {
      handleEditGroup(route.params.editGroup);
      navigation.setParams({editGroup: undefined});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.editGroup, groups]);

  useEffect(() => {
    if (route?.params?.editGroup && !loading && groups.length === 0) {
      handleEditGroup(route.params.editGroup);
      navigation.setParams({editGroup: undefined});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.editGroup, loading, groups.length]);

  useEffect(() => {
    const fetchSplitHistory = async () => {
      try {
        if (!currentUser) {
          return;
        }
        const snap = await getDocs(
          fsQuery(
            collection(
              getFirestore(),
              'users',
              currentUser.uid,
              'splitHistory',
            ),
            orderBy('createdAt', 'desc'),
            limit(20),
          ),
        );
        setSplitHistory(snap.docs.map(doc => ({id: doc.id, ...doc.data()})));
      } catch (_) {}
    };
    fetchSplitHistory();
  }, [currentUser]);

  const fetchUserByEmailOrPhone = async (query: string) => {
    try {
      const trimmed = (query || '').trim();
      const isPhone = /^\d+$/.test(trimmed);
      let found;
      if (isPhone) {
        found = await lookupUserByPhone(trimmed);
      } else if (trimmed.includes('@')) {
        found = await lookupUserByEmail(trimmed.toLowerCase());
      } else {
        return;
      }
      if (found) {
        setUserDetails({
          email: found.email,
          name: found.name,
          avatar: found.avatar,
          userId: found.uid,
        });
      } else {
        const fallbackEmail = trimmed.includes('@')
          ? trimmed.toLowerCase()
          : trimmed;
        setUserDetails({name: 'Not Registered', email: fallbackEmail});
      }
    } catch (_) {
      Alert.alert('Error', 'Failed to fetch user');
    }
  };

  const toggleUserSelection = (user: UserDetail) => {
    if (user.email === currentUser?.email) {
      Alert.alert(
        'Cannot Add Yourself',
        'You cannot add yourself to the group. You are automatically included as the group creator.',
      );
      return;
    }
    const wasAdded = !selectedUsers.some(s => s.email === user.email);
    setSelectedUsers(prev => {
      const isSelected = prev.some(s => s.email === user.email);
      return isSelected
        ? prev.filter(s => s.email !== user.email)
        : [...prev, user];
    });
    if (wasAdded) {
      setSearchQuery('');
      setUserDetails(null);
      setUnregisteredName('');
    }
  };

  const handleEditGroup = (group: Group) => {
    try {
      const updatedMembers = [...group.members];
      const updatedMemberDetails = [...group.memberDetails];
      const idx = updatedMembers.indexOf(currentUser?.email ?? '');
      if (idx > -1) {
        updatedMembers.splice(idx, 1);
        updatedMemberDetails.splice(idx, 1);
      }
      setGroupName(group.name);
      setCategory(group.category ?? null);
      setSelectedUsers(updatedMemberDetails);
      setIsFormVisible(true);
      setEditingGroupId(group.id);
    } catch (_) {
      Alert.alert('Error', 'Failed to prepare group for editing');
    }
  };

  const refreshHistory = async () => {
    try {
      const snap = await getDocs(
        fsQuery(
          collection(getFirestore(), 'users', currentUser!.uid, 'splitHistory'),
          orderBy('createdAt', 'desc'),
          limit(20),
        ),
      );
      setSplitHistory(snap.docs.map(doc => ({id: doc.id, ...doc.data()})));
    } catch (_) {}
  };

  const resetGroupForm = () => {
    setGroupName('');
    setCategory(null);
    setSelectedUsers([]);
    setIsFormVisible(false);
    setEditingGroupId(null);
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Validation Error', 'Group name is required');
      return;
    }
    if (groupName.trim().length > 50) {
      Alert.alert(
        'Validation Error',
        'Group name must be 50 characters or less',
      );
      return;
    }
    if (!category) {
      Alert.alert('Validation Error', 'Please select a category');
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert(
        'Validation Error',
        'Please select at least one user to add to the group',
      );
      return;
    }
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      const prevGroup = editingGroupId
        ? groups.find(g => g.id === editingGroupId)
        : null;
      const memberNames = selectedUsers.reduce<Record<string, string>>(
        (acc, u) => {
          if (u.email && u.name) {
            acc[u.email] = String(u.name);
          }
          return acc;
        },
        {},
      );
      if (currentUser?.email) {
        memberNames[currentUser.email] = currentUser.displayName || 'You';
      }
      const inviteeEmails = selectedUsers.map(u => u.email);
      const groupData: DocumentData = {
        name: groupName,
        category,
        members: [currentUser?.email],
        createdBy: currentUser?.uid,
        updatedAt: serverTimestamp(),
        memberNames,
        pendingInvites: inviteeEmails,
      };
      if (editingGroupId) {
        // Editing must not rebuild the member list from scratch: people who are already members
        // stay members, pending invitations stay pending, and only people added now are invited.
        // createdBy is never rewritten (whoever edits would otherwise become the owner).
        const plan = planGroupEdit(
          prevGroup?.members ?? [],
          prevGroup?.pendingInvites ?? [],
          inviteeEmails,
          currentUser?.email ?? '',
        );
        const keptMembers = plan.members;
        const newInvitees = plan.newInvitees;
        const editData: DocumentData = {
          name: groupName,
          category,
          updatedAt: serverTimestamp(),
          memberNames,
          members: plan.members,
          pendingInvites: plan.pendingInvites,
        };
        await updateDoc(
          fsDoc(getFirestore(), 'groups', editingGroupId),
          editData,
        );
        if (newInvitees.length > 0) {
          const inviteBatch = writeBatch(getFirestore());
          const editorName = currentUser?.displayName || currentUser?.email;
          newInvitees.forEach(email => {
            inviteBatch.set(fsDoc(collection(getFirestore(), 'invitations')), {
              email,
              groupId: editingGroupId,
              groupName: groupName,
              category,
              inviterUid: currentUser?.uid,
              inviterEmail: currentUser?.email,
              inviterName: editorName,
              status: 'pending',
              createdAt: Timestamp.fromDate(new Date()),
            });
          });
          await inviteBatch.commit();
          newInvitees.forEach(email => {
            SplitNotificationService.notifySplitInvite(
              {id: editingGroupId, name: groupName, category} as any,
              currentUser?.displayName ||
                currentUser?.email?.split('@')[0] ||
                'Someone',
              email,
            ).catch(() => {});
          });
        }
        setGroups(prev =>
          prev.map(g =>
            g.id === editingGroupId
              ? {
                  ...g,
                  ...editData,
                  memberDetails: [
                    ...selectedUsers,
                    {
                      email: currentUser?.email ?? '',
                      name: currentUser?.displayName || 'You',
                    },
                  ],
                }
              : g,
          ),
        );
        addDoc(
          collection(getFirestore(), 'users', currentUser!.uid, 'splitHistory'),
          {
            type: 'update',
            groupId: editingGroupId,
            groupName: groupName,
            previousGroupName: prevGroup?.name,
            category,
            membersCount: 1,
            createdAt: Timestamp.fromDate(new Date()),
          },
        )
          .then(() => refreshHistory())
          .catch(() => {});
        SplitNotificationService.notifyGroupUpdated(
          {
            id: editingGroupId,
            name: groupName,
            category,
            members: [...keptMembers, ...newInvitees],
          } as any,
          currentUser?.displayName ||
            currentUser?.email?.split('@')[0] ||
            'Someone',
          {},
        ).catch(() => {});
        Alert.alert('Success', 'Group updated successfully', [
          {text: 'OK', onPress: resetGroupForm},
        ]);
      } else {
        groupData.createdAt = serverTimestamp();
        const groupRef = await addDoc(
          collection(getFirestore(), 'groups'),
          groupData,
        );
        const inviterName = currentUser?.displayName || currentUser?.email;
        const batch = writeBatch(getFirestore());
        inviteeEmails.forEach(email => {
          const inviteRef = fsDoc(collection(getFirestore(), 'invitations'));
          batch.set(inviteRef, {
            email,
            groupId: groupRef.id,
            groupName: groupName,
            category,
            inviterUid: currentUser?.uid,
            inviterEmail: currentUser?.email,
            inviterName,
            status: 'pending',
            createdAt: Timestamp.fromDate(new Date()),
          });
        });
        await batch.commit();
        SplitNotificationService.notifyGroupCreated(
          {
            id: groupRef.id,
            name: groupName,
            category,
            pendingInvites: inviteeEmails,
          } as any,
          currentUser?.displayName ||
            currentUser?.email?.split('@')[0] ||
            'Someone',
        ).catch(() => {});
        for (const email of inviteeEmails) {
          SplitNotificationService.notifySplitInvite(
            {id: groupRef.id, name: groupName, category} as any,
            currentUser?.displayName ||
              currentUser?.email?.split('@')[0] ||
              'Someone',
            email,
          ).catch(() => {});
        }
        const memberDetails = [
          {
            email: currentUser?.email ?? '',
            name:
              currentUser?.displayName ||
              memberNames[currentUser?.email ?? ''] ||
              'You',
          },
        ];
        setGroups(prev =>
          prev.some(g => g.id === groupRef.id)
            ? prev
            : [
                ...prev,
                {id: groupRef.id, ...groupData, memberDetails} as Group,
              ],
        );
        addDoc(
          collection(getFirestore(), 'users', currentUser!.uid, 'splitHistory'),
          {
            type: 'create',
            groupId: groupRef.id,
            groupName: groupName,
            category,
            membersCount: 1,
            createdAt: Timestamp.fromDate(new Date()),
          },
        )
          .then(() => refreshHistory())
          .catch(() => {});
        Alert.alert('Success', 'Group created successfully', [
          {text: 'OK', onPress: resetGroupForm},
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to create/update group');
    } finally {
      setSaving(false);
    }
  };

  // Currently unused (group deletion lives in the group detail screen); kept for reference.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _deleteGroup = async (groupId: string) => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            let groupDoc;
            try {
              groupDoc = await getDoc(fsDoc(getFirestore(), 'groups', groupId));
            } catch (_) {}
            await deleteDoc(fsDoc(getFirestore(), 'groups', groupId));
            setGroups(prev => prev.filter(g => g.id !== groupId));
            try {
              await addDoc(
                collection(
                  getFirestore(),
                  'users',
                  currentUser!.uid,
                  'splitHistory',
                ),
                {
                  type: 'delete',
                  groupId,
                  groupName: (groupDoc as any)?.data()?.name || 'Group',
                  createdAt: Timestamp.fromDate(new Date()),
                },
              );
              await refreshHistory();
            } catch (_) {}
            Alert.alert('Success', 'Group deleted successfully');
          },
        },
      ],
    );
  };

  const renderUserCard = (user: UserDetail, withCheckbox = false) => {
    const isSelected = selectedUsers.some(s => s.email === user.email);
    return (
      <View style={styles.userCard} key={user.email}>
        <UserAvatar size={50} name={String(user.name || user.email)} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{String(user.name || user.email)}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.email === currentUser?.email && (
            <Text style={styles.youLabel}>(You - Group Creator)</Text>
          )}
        </View>
        {withCheckbox &&
          user.email !== currentUser?.email &&
          (Platform.OS === 'ios' ? (
            <TouchableOpacity
              onPress={() => toggleUserSelection(user)}
              activeOpacity={0.7}>
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
            </TouchableOpacity>
          ) : (
            <Checkbox
              status={isSelected ? 'checked' : 'unchecked'}
              onPress={() => toggleUserSelection(user)}
            />
          ))}
      </View>
    );
  };

  const renderGroupCard = (group: Group) => {
    const iconName = getCategoryIcon(group.category || '');
    return (
      <Card
        key={group.id}
        style={[
          styles.groupCard,
          Platform.OS === 'android' && styles.cardAndroid,
        ]}
        elevation={Platform.OS === 'android' ? 0 : 2}>
        <TouchableOpacity
          style={styles.groupCardContent}
          onPress={() =>
            navigation.navigate('SplitGroupDetail', {
              group: {
                id: group.id,
                name: group.name,
                category: group.category,
                members: group.members,
                memberDetails: group.memberDetails,
              },
            })
          }>
          <View style={styles.groupCardHeader}>
            <View style={styles.groupCardLeft}>
              <View style={styles.categoryIconContainer}>
                <MaterialCommunityIcons
                  name={iconName}
                  size={24}
                  color="#fff"
                />
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={styles.memberCountContainer}>
                  <MaterialCommunityIcons
                    name="account-multiple"
                    size={14}
                    color="#666"
                  />
                  <Text style={styles.groupMembers}>
                    {group.members.length}{' '}
                    {group.members.length === 1 ? 'Member' : 'Members'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading groups...</Text>
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
                name="account-group"
                size={32}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.headerTitle}>Split Groups</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Manage your expense groups
            </Text>
          </View>
          <View style={styles.quickAccessRow}>
            <TouchableOpacity
              style={styles.quickAccessButton}
              onPress={() => navigation.navigate('FriendsBalance')}>
              <MaterialCommunityIcons
                name="account-multiple"
                size={22}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.quickAccessText}>Friends</Text>
            </TouchableOpacity>
            {getConfig().enable_iou_feature && (
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('IOU')}>
                <MaterialCommunityIcons
                  name="handshake"
                  size={22}
                  color={PRIMARY_COLOR}
                />
                <Text style={styles.quickAccessText}>IOUs</Text>
              </TouchableOpacity>
            )}
          </View>
          <Card
            style={[
              styles.createGroupCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <TouchableOpacity
                style={styles.createGroupHeader}
                activeOpacity={0.7}
                onPress={() => {
                  if (!isFormVisible) {
                    setEditingGroupId(null);
                    setGroupName('');
                    setCategory(null);
                    setSelectedUsers([]);
                  }
                  setIsFormVisible(!isFormVisible);
                }}>
                <Text style={styles.createGroupTitle}>
                  {editingGroupId ? 'Edit Group' : 'Create New Group'}
                </Text>
                <MaterialCommunityIcons
                  name={isFormVisible ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={PRIMARY_COLOR}
                />
              </TouchableOpacity>
              {isFormVisible && (
                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Group Name</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter group name"
                      placeholderTextColor="#999"
                      value={groupName}
                      onChangeText={setGroupName}
                      maxLength={50}
                    />
                    <Text style={styles.characterCount}>
                      {groupName.length}/50
                    </Text>
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <SelectModal
                      value={category}
                      options={GROUP_CATEGORIES}
                      onChange={setCategory}
                      placeholder="Select Group Category"
                      searchPlaceholder="Search categories..."
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Add Members</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Search user by email or phone number"
                      placeholderTextColor="#999"
                      value={searchQuery}
                      onChangeText={query => {
                        setSearchQuery(query);
                        if (query.includes('@') || /^\d+$/.test(query)) {
                          fetchUserByEmailOrPhone(query);
                        }
                      }}
                      keyboardType="email-address"
                    />
                  </View>
                  {userDetails &&
                    userDetails.email !== currentUser?.email &&
                    renderUserCard(userDetails, true)}
                  {userDetails && userDetails.email === currentUser?.email && (
                    <View style={styles.warningCard}>
                      <Text style={styles.warningText}>
                        ⚠️ You cannot add yourself to the group. You are
                        automatically included.
                      </Text>
                    </View>
                  )}
                  <View style={styles.selectedContainer}>
                    <Text style={styles.selectedUsersLabel}>
                      Selected Users:
                    </Text>
                    {selectedUsers.map(user => renderUserCard(user, true))}
                    {selectedUsers.length === 0 && (
                      <Text style={styles.emptySelectionText}>
                        No users selected yet. Search and add members above.
                      </Text>
                    )}
                  </View>
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.createGroupButton,
                        saving && {opacity: 0.6},
                      ]}
                      onPress={createGroup}
                      disabled={saving}>
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.createGroupButtonText}>
                            {editingGroupId ? 'Update Group' : 'Create Group'}
                          </Text>
                          <MaterialCommunityIcons
                            name={editingGroupId ? 'pencil' : 'check'}
                            size={20}
                            color="#fff"
                          />
                        </>
                      )}
                    </TouchableOpacity>
                    {editingGroupId && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setEditingGroupId(null);
                          setGroupName('');
                          setCategory(null);
                          setSelectedUsers([]);
                          setIsFormVisible(false);
                        }}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                        <MaterialCommunityIcons
                          name="close"
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          </Card>
          <View style={styles.groupsSection}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}>
              <Text
                style={[styles.sectionTitle, {marginBottom: 0, flexShrink: 1}]}
                numberOfLines={1}
                ellipsizeMode="tail">
                Your Groups
              </Text>
              <View style={styles.groupsHeaderActions}>
                <TouchableOpacity
                  style={styles.iconActionButton}
                  onPress={() => navigation.navigate('Invitations')}>
                  <MaterialCommunityIcons
                    name="account-multiple-plus-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  {invitationsCount > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#FF3B30',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                      }}>
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 'bold',
                        }}
                        numberOfLines={1}>
                        {invitationsCount > 99
                          ? '99+'
                          : String(invitationsCount)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconActionButton}
                  onPress={() => navigation.navigate('SplitHistory')}>
                  <MaterialCommunityIcons
                    name="history"
                    size={20}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            </View>
            {groups.length === 0 ? (
              <Card
                style={[
                  styles.emptyStateCard,
                  Platform.OS === 'android' && styles.cardAndroid,
                ]}
                elevation={Platform.OS === 'android' ? 0 : 1}>
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={64}
                    color="#CBD3EE"
                  />
                  <Text style={styles.emptyStateText}>
                    No groups created yet
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    Create your first group to start splitting expenses
                  </Text>
                </View>
              </Card>
            ) : (
              groups.map(renderGroupCard)
            )}
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default SplitScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
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
  createGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {padding: 25},
  createGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createGroupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  formContainer: {marginTop: 20},
  inputContainer: {marginBottom: 15},
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  userInfo: {marginLeft: 15, flex: 1},
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  userEmail: {fontSize: 14, color: '#666', fontFamily: 'Lato-Regular'},
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
  selectedContainer: {marginTop: 15},
  selectedUsersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 10,
    fontFamily: 'Lato-Bold',
  },
  emptySelectionText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Lato-Regular',
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  warningText: {fontSize: 14, color: '#E65100', fontFamily: 'Lato-Regular'},
  buttonContainer: {marginTop: 20, gap: 12},
  createGroupButton: {
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
  createGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    fontFamily: 'Lato-Bold',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingVertical: 15,
    borderRadius: 12,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    fontFamily: 'Lato-Bold',
  },
  groupsSection: {paddingHorizontal: 20, paddingBottom: 30},
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  groupCard: {backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 15},
  groupCardContent: {padding: 22},
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupCardLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  groupInfo: {marginLeft: 12, flex: 1},
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 4,
  },
  memberCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  groupMembers: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginLeft: 4,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyStateCard: {backgroundColor: '#FFFFFF', borderRadius: 16},
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
    fontFamily: 'Lato-Bold',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
    fontFamily: 'Lato-Regular',
  },
  youLabel: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontStyle: 'italic',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  quickAccessRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    gap: 12,
  },
  quickAccessButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  quickAccessText: {fontSize: 14, color: '#677CD2', fontFamily: 'Lato-Bold'},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
