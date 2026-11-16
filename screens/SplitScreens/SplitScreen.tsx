import React, {useState, useEffect, useMemo} from 'react';
import {useAsyncAction} from '../../src/hooks/useAsyncAction';
import {
  ActivityIndicator,
  FlatList,
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  Platform,
  type ScrollViewProps,
} from 'react-native';
import Card from '../../src/components/Card';
import Text from '../../src/components/Text';
import TickBox from '../../src/components/TickBox';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc as fsDoc,
  getDoc,
  getFirestore,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import type {DocumentData} from '@react-native-firebase/firestore';
import {planGroupEdit} from '../../src/utils/groupEdit';
import {
  lookupUserByEmail,
  lookupUserByPhone,
} from '../../src/services/UserLookup';
import {getAuth} from '@react-native-firebase/auth';
import {useFocusEffect, useLocalSearchParams, useRouter} from 'expo-router';
import BookOpen from 'lucide-react-native/icons/book-open';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import CircleEllipsis from 'lucide-react-native/icons/circle-ellipsis';
import Handshake from 'lucide-react-native/icons/handshake';
import Heart from 'lucide-react-native/icons/heart';
import History from 'lucide-react-native/icons/history';
import House from 'lucide-react-native/icons/house';
import Palette from 'lucide-react-native/icons/palette';
import Pencil from 'lucide-react-native/icons/pencil';
import Plane from 'lucide-react-native/icons/plane';
import Trophy from 'lucide-react-native/icons/trophy';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import UserAvatar from '../../src/components/Avatar';
import SelectModal from '../../src/components/SelectModal';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../../src/components/KeyboardAwareScrollView';
import SplitNotificationService from '../../services/SplitNotificationService';
import ReminderNotificationService from '../../services/ReminderNotificationService';
import {getConfig} from '../../src/services/RemoteConfigService';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {ErrorState, LoadingState} from '../../src/components/ScreenState';
import {
  useGroups,
  useInvitations,
  useMemberDetails,
} from '../../src/data/split';
import type {AppIcon} from '../../src/types/icons';
import {snackbar} from '../../src/utils/snackbarStore';

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

const GROUP_CATEGORY_ICONS: Record<string, AppIcon> = {
  Work: Briefcase,
  Family: House,
  Couple: Heart,
  Friends: Users,
  Travel: Plane,
  Sports: Trophy,
  Hobby: Palette,
  Study: BookOpen,
  Other: CircleEllipsis,
};

// The icon colour comes from the theme, so the options are built inside the component.
const buildGroupCategories = (color: string) =>
  Object.entries(GROUP_CATEGORY_ICONS).map(([value, Icon]) => ({
    label: value,
    value,
    icon: () => <Icon size={24} color={color} />,
  }));

const getCategoryIcon = (value: string): AppIcon =>
  GROUP_CATEGORY_ICONS[value] || Users;

// A stable empty list for the groups, so the list does not see new data on every render.
const NO_GROUPS: Group[] = [];

const groupKey = (group: Group) => group.id;

// The list's scroll container is the app's keyboard-aware one, because the create-group form in
// the list header has text inputs that must stay above the keyboard.
const renderKeyboardAwareScroll = (props: ScrollViewProps) => (
  <KeyboardAwareScrollView {...props} />
);

const SplitScreen = () => {
  const router = useRouter();
  // Set by the group detail screen's edit button; opens that group's edit form once loaded.
  const {editGroupId} = useLocalSearchParams<{editGroupId?: string}>();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const groupCategories = React.useMemo(
    () => buildGroupCategories(colors.primary),
    [colors.primary],
  );
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDetails, setUserDetails] = useState<UserDetail | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<UserDetail[]>([]);
  // The groups come from the shared cache, which a live listener keeps current (src/data/split.ts),
  // so a group created, edited or deleted here, or by someone else, shows up without a reload.
  const groupsData = useGroups();
  const rawGroups = groupsData.data;
  const allMemberEmails = useMemo(
    () => [...new Set((rawGroups ?? []).flatMap(g => g.members ?? []))],
    [rawGroups],
  );
  const foundMembers = useMemberDetails(allMemberEmails);
  const groups: Group[] = useMemo(
    () =>
      (rawGroups ?? []).map(
        g =>
          ({
            ...g,
            memberDetails: (g.members ?? []).map(email => {
              const match = foundMembers?.[email];
              return match
                ? {
                    email,
                    name: match.name || g.memberNames?.[email] || null,
                    avatar: match.avatar,
                    userId: match.uid,
                  }
                : {email, name: g.memberNames?.[email] || null};
            }),
          } as Group),
      ),
    [rawGroups, foundMembers],
  );
  const invitations = useInvitations();
  const invitationsCount = invitations.data?.length ?? 0;
  const loading = groupsData.loading;
  // A failed load must not read as "No groups created yet".
  const failed = groupsData.error;
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [_unregisteredName, setUnregisteredName] = useState('');
  const currentUser = getAuth().currentUser;

  useFocusEffect(
    React.useCallback(() => {
      ReminderNotificationService.processRecurringSplits().catch(() => {});
    }, []),
  );

  // Opens the edit form of the group chosen on the group screen, once the list is confirmed.
  useEffect(() => {
    if (editGroupId && groupsData.live && groups.length > 0) {
      const target = groups.find(g => g.id === editGroupId);
      if (target) {
        handleEditGroup(target);
        router.setParams({editGroupId: undefined});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editGroupId, groups, groupsData.live]);

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
      snackbar.error('Failed to fetch user');
    }
  };

  const toggleUserSelection = (user: UserDetail) => {
    if (user.email === currentUser?.email) {
      snackbar.error(
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
    // The edit rewrites the member list from what is on screen, so it waits for the live listener
    // to confirm the groups: a saved copy could be older than what someone else changed.
    if (!groupsData.live) {
      snackbar.info('Still syncing your groups. Try again in a moment.');
      return;
    }
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
      snackbar.error('Failed to prepare group for editing');
    }
  };

  const resetGroupForm = () => {
    setGroupName('');
    setCategory(null);
    setSelectedUsers([]);
    setIsFormVisible(false);
    setEditingGroupId(null);
  };

  const saveGroup = async () => {
    if (!groupName.trim()) {
      snackbar.error('Group name is required');
      return;
    }
    if (groupName.trim().length > 50) {
      snackbar.error('Group name must be 50 characters or less');
      return;
    }
    if (!category) {
      snackbar.error('Please select a category');
      return;
    }
    if (selectedUsers.length === 0) {
      snackbar.error('Please select at least one user to add to the group');
      return;
    }
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
        ).catch(() => {});
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
        snackbar.success('Group updated successfully');
        resetGroupForm();
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
        ).catch(() => {});
        snackbar.success('Group created successfully');
        resetGroupForm();
      }
    } catch (err) {
      snackbar.error('Failed to create/update group');
    }
  };
  const {run: createGroup, pending: saving} = useAsyncAction(saveGroup);

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
            } catch (_) {}
            snackbar.success('Group deleted successfully');
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
        {withCheckbox && user.email !== currentUser?.email && (
          <TouchableOpacity
            accessibilityLabel={`Select ${user.name || user.email}`}
            onPress={() => toggleUserSelection(user)}
            activeOpacity={0.7}>
            <TickBox selected={isSelected} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderGroupCard = (group: Group) => {
    const GroupIcon = getCategoryIcon(group.category || '');
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
            router.navigate({
              pathname: '/split/group/[groupId]',
              params: {groupId: group.id, groupName: group.name},
            })
          }>
          <View style={styles.groupCardHeader}>
            <View style={styles.groupCardLeft}>
              <View style={styles.categoryIconContainer}>
                <GroupIcon size={24} color={colors.onPrimary} />
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={styles.memberCountContainer}>
                  <Users size={14} color={colors.textSecondary} />
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
    return <LoadingState message="Loading groups..." />;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <FlatList
          // While the list failed to load, show only its error (not a saved copy).
          data={failed ? NO_GROUPS : groups}
          keyExtractor={groupKey}
          renderItem={({item}) => (
            <View style={styles.groupRow}>{renderGroupCard(item)}</View>
          )}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          renderScrollComponent={renderKeyboardAwareScroll}
          ListHeaderComponent={
            <>
              <View style={styles.headerSection}>
                <View style={styles.headerTitleRow}>
                  <Users size={32} color={colors.primary} />
                  <Text style={styles.headerTitle}>Split Groups</Text>
                </View>
                <Text style={styles.headerSubtitle}>
                  Manage your expense groups
                </Text>
              </View>
              <View style={styles.quickAccessRow}>
                <TouchableOpacity
                  style={styles.quickAccessButton}
                  onPress={() => router.navigate('/split/friends')}>
                  <Users size={22} color={colors.primary} />
                  <Text style={styles.quickAccessText}>Friends</Text>
                </TouchableOpacity>
                {getConfig().enable_iou_feature && (
                  <TouchableOpacity
                    style={styles.quickAccessButton}
                    onPress={() => router.navigate('/split/iou')}>
                    <Handshake size={22} color={colors.primary} />
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
                    {isFormVisible ? (
                      <ChevronUp size={24} color={colors.primary} />
                    ) : (
                      <ChevronDown size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                  {isFormVisible && (
                    <View style={styles.formContainer}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Group Name</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Enter group name"
                          placeholderTextColor={colors.textPlaceholder}
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
                          options={groupCategories}
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
                          placeholderTextColor={colors.textPlaceholder}
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
                      {userDetails &&
                        userDetails.email === currentUser?.email && (
                          <View style={styles.warningCard}>
                            <TriangleAlert
                              size={18}
                              color={colors.warningText}
                            />
                            <Text style={styles.warningText}>
                              You cannot add yourself to the group. You are
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
                            saving && styles.createGroupButtonSaving,
                          ]}
                          onPress={createGroup}
                          disabled={saving}>
                          {saving ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.onPrimary}
                            />
                          ) : (
                            <>
                              <Text style={styles.createGroupButtonText}>
                                {editingGroupId
                                  ? 'Update Group'
                                  : 'Create Group'}
                              </Text>
                              {editingGroupId ? (
                                <Pencil size={20} color={colors.onPrimary} />
                              ) : (
                                <Check size={20} color={colors.onPrimary} />
                              )}
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
                            <X size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </Card>
              <View style={styles.groupRow}>
                <View style={styles.groupsHeaderRow}>
                  <Text
                    style={[styles.sectionTitle, styles.groupsSectionTitle]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    Your Groups
                  </Text>
                  <View style={styles.groupsHeaderActions}>
                    <TouchableOpacity
                      style={styles.iconActionButton}
                      onPress={() => router.navigate('/split/invitations')}>
                      <UserPlus size={20} color={colors.onPrimary} />
                      {invitationsCount > 0 && (
                        <View style={styles.invitationsBadge}>
                          <Text
                            style={styles.invitationsBadgeText}
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
                      onPress={() => router.navigate('/split/history')}>
                      <History size={20} color={colors.onPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.groupRow}>
              {failed ? (
                <ErrorState
                  fill={false}
                  title="Could not load your groups"
                  onRetry={groupsData.retry}
                />
              ) : (
                <Card
                  style={[
                    styles.emptyStateCard,
                    Platform.OS === 'android' && styles.cardAndroid,
                  ]}
                  elevation={Platform.OS === 'android' ? 0 : 1}>
                  <View style={styles.emptyState}>
                    <Users size={64} color={colors.iconMuted} />
                    <Text style={styles.emptyStateText}>
                      No groups created yet
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      Create your first group to start splitting expenses
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          }
          ListFooterComponent={<View style={styles.listFooter} />}
        />
      </View>
    </SafeAreaProvider>
  );
};

export default SplitScreen;

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
    createGroupCard: {
      backgroundColor: colors.surface,
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
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    formContainer: {marginTop: 20},
    inputContainer: {marginBottom: 15},
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
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 15,
      borderRadius: 12,
      marginBottom: 10,
      elevation: Platform.OS === 'android' ? 0 : 1,
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    userInfo: {marginLeft: 15, flex: 1},
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    userEmail: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
    },
    selectedContainer: {marginTop: 15},
    selectedUsersLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 10,
      fontFamily: 'Lato-Bold',
    },
    emptySelectionText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      fontStyle: 'italic',
      fontFamily: 'Lato-Regular',
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.warningSoft,
      padding: 15,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    warningText: {
      flex: 1,
      fontSize: 14,
      color: colors.warningText,
      fontFamily: 'Lato-Regular',
    },
    buttonContainer: {marginTop: 20, gap: 12},
    createGroupButton: {
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
    createGroupButtonSaving: {opacity: 0.6},
    createGroupButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginRight: 8,
      fontFamily: 'Lato-Bold',
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: 15,
      borderRadius: 12,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      marginRight: 8,
      fontFamily: 'Lato-Bold',
    },
    groupRow: {paddingHorizontal: 20},
    listFooter: {height: 30},
    groupsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      marginBottom: 15,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    groupsSectionTitle: {marginBottom: 0, flexShrink: 1},
    groupCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: 15,
    },
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
      color: colors.textStrong,
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
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
      marginLeft: 4,
    },
    categoryIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryFill,
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
      backgroundColor: colors.primaryFill,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    invitationsBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.expenseFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    invitationsBadgeText: {
      color: colors.onPrimary,
      fontSize: 11,
      fontWeight: 'bold',
    },
    emptyStateCard: {backgroundColor: colors.surface, borderRadius: 16},
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyStateText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 15,
      marginBottom: 5,
      fontFamily: 'Lato-Bold',
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    characterCount: {
      fontSize: 12,
      color: colors.textPlaceholder,
      marginTop: 4,
      textAlign: 'right',
      fontFamily: 'Lato-Regular',
    },
    youLabel: {
      fontSize: 12,
      color: colors.primary,
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
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    quickAccessText: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: 'Lato-Bold',
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
  });
