import React, {useState, useEffect} from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import {Text, Provider, Checkbox, Card, ActivityIndicator} from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {useFocusEffect} from '@react-navigation/native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from 'react-native-user-avatar';
import DropDownPicker from 'react-native-dropdown-picker';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import SplitNotificationService from '../../services/SplitNotificationService';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
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
const SplitScreen = ({navigation, route}) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [category, setCategory] = useState(null);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);
  
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unregisteredName, setUnregisteredName] = useState('');
  const [splitHistory, setSplitHistory] = useState([]);
  const [invitationsCount, setInvitationsCount] = useState(0);
  const currentUser = auth().currentUser;
  
  // Fetch user's groups
  const fetchGroups = async () => {
    try {
      setLoading(true);
      if (!currentUser) return;
      const groupSnapshot = await firestore()
        .collection('groups')
        .where('members', 'array-contains', currentUser.email)
        .get();
      const fetchedGroups = await Promise.all(
        groupSnapshot.docs.map(async doc => {
          const groupData = doc.data();
          // Fetch member details
          const memberPromises = groupData.members.map(async email => {
            const userSnapshot = await firestore()
              .collection('users')
              .where('email', '==', email)
              .get();
            if (!userSnapshot.empty) {
              const userData = userSnapshot.docs[0].data();
              return {
                email,
                name: userData.name || userData.displayName || groupData.memberNames?.[email] || null,
                userId: userSnapshot.docs[0].id,
                ...userData,
              };
            }
            return {email, name: groupData.memberNames?.[email] || null};
          });
          const memberDetails = await Promise.all(memberPromises);
          return {
            id: doc.id,
            ...groupData,
            memberDetails,
          };
        }),
      );
      setGroups(fetchedGroups);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  // Refresh groups when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchGroups();
    }, [currentUser]),
  );

  // Subscribe to pending invitations count for badge
  useEffect(() => {
    if (!currentUser?.email) return;
    const unsub = firestore()
      .collection('invitations')
      .where('email', '==', currentUser.email)
      .where('status', '==', 'pending')
      .onSnapshot(
        snapshot => {
          setInvitationsCount(snapshot.size);
        },
        () => {
          // non-blocking: ignore errors
        },
      );
    return () => unsub && unsub();
  }, [currentUser?.email]);
  // Handle deep-link edit from SplitGroupDetailScreen
  useEffect(() => {
    if (route?.params?.editGroupId && groups.length > 0) {
      const target = groups.find(g => g.id === route.params.editGroupId);
      if (target) {
        handleEditGroup(target);
        // clear param so it doesn't re-trigger
        navigation.setParams({ editGroupId: undefined });
      }
    }
  }, [route?.params?.editGroupId, groups]);

  // Handle editGroup parameter from SplitGroupDetailScreen
  useEffect(() => {
    if (route?.params?.editGroup && groups.length > 0) {
      const editGroup = route.params.editGroup;
      handleEditGroup(editGroup);
      // clear param so it doesn't re-trigger
      navigation.setParams({ editGroup: undefined });
    }
  }, [route?.params?.editGroup, groups]);

  // Handle editGroup parameter when it's passed but groups haven't loaded yet
  useEffect(() => {
    if (route?.params?.editGroup && !loading && groups.length === 0) {
      // If we have editGroup param but no groups loaded, it means we're editing a group
      // that might not be in the current user's groups list, so handle it directly
      const editGroup = route.params.editGroup;
      handleEditGroup(editGroup);
      // clear param so it doesn't re-trigger
      navigation.setParams({ editGroup: undefined });
    }
  }, [route?.params?.editGroup, loading, groups.length]);
  // Fetch split recent activity
  useEffect(() => {
    const fetchSplitHistory = async () => {
      try {
        if (!currentUser) return;
        const historySnapshot = await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .collection('splitHistory')
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();
        const history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSplitHistory(history);
      } catch (e) {
        // non-blocking
      }
    };
    fetchSplitHistory();
  }, [currentUser]);
  // Fetch user by email or phone
  const fetchUserByEmailOrPhone = async query => {
    try {
      // Check if query is a phone number (contains only digits)
      const trimmed = (query || '').trim();
      const isPhoneNumber = /^\d+$/.test(trimmed);
      let userSnapshot;
      if (isPhoneNumber) {
        // Search by phone number with exact match
        userSnapshot = await firestore()
          .collection('users')
          .where('phone', '==', trimmed)
          .get();
      } else if (trimmed.includes('@')) {
        // Search by email
        const lowerEmail = trimmed.toLowerCase();
        userSnapshot = await firestore()
          .collection('users')
          .where('email', '==', lowerEmail)
          .get();
      }
      if (!userSnapshot.empty) {
        const user = userSnapshot.docs[0].data();
        setUserDetails(user);
      } else {
        const fallbackEmail = trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
        setUserDetails({name: 'Not Registered', email: fallbackEmail});
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch user');
    }
  };
  // Add/remove user from selected list
  const toggleUserSelection = user => {
    // Prevent adding yourself
    if (user.email === currentUser.email) {
      Alert.alert('Cannot Add Yourself', 'You cannot add yourself to the group. You are automatically included as the group creator.');
      return;
    }
    
    const wasAdded = !selectedUsers.some(selected => selected.email === user.email);
    
    setSelectedUsers(prev => {
      const isSelected = prev.some(selected => selected.email === user.email);
      if (isSelected) {
        return prev.filter(selected => selected.email !== user.email);
      } else {
        return [...prev, user];
      }
    });
    
    // Clear search and user details after adding
    if (wasAdded) {
      setSearchQuery('');
      setUserDetails(null);
      setUnregisteredName('');
    }
  };
  
  // (name edit functionality removed per revert)
  
  // Edit group members
  const handleEditGroup = async (group) => {
    try {
      const updatedMembers = [...group.members];
      const updatedMemberDetails = [...group.memberDetails];
      // Remove current user from the lists for editing
      const currentUserIndex = updatedMembers.indexOf(currentUser.email);
      if (currentUserIndex > -1) {
        updatedMembers.splice(currentUserIndex, 1);
        updatedMemberDetails.splice(currentUserIndex, 1);
      }
      // Set the current state for editing
      setGroupName(group.name);
      setCategory(group.category);
      setSelectedUsers(updatedMemberDetails);
      setIsFormVisible(true);
      // Store the group ID for updating
      setEditingGroupId(group.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to prepare group for editing');
    }
  };
  // Create or update a group
  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Validation Error', 'Group name is required');
      return;
    }
    if (!category) {
      Alert.alert('Validation Error', 'Please select a category');
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one user to add to the group');
      return;
    }
    try {
      const prevGroup = editingGroupId ? groups.find(g => g.id === editingGroupId) : null;
      const memberNames = selectedUsers.reduce((acc, u) => {
        if (u.email && u.name) {
          acc[u.email] = u.name;
        }
        return acc;
      }, {});
      if (currentUser?.email && (currentUser.displayName || currentUser.email)) {
        memberNames[currentUser.email] = currentUser.displayName || 'You';
      }
      const inviteeEmails = selectedUsers.map(user => user.email);
      const groupData = {
        name: groupName,
        category: category,
        members: [
          // only creator is immediately a member; others join on accept
          currentUser.email,
        ],
        createdBy: currentUser.uid,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        memberNames,
        pendingInvites: inviteeEmails,
      };
      if (editingGroupId) {
        // Update existing group
        await firestore()
          .collection('groups')
          .doc(editingGroupId)
          .update(groupData);
        // Update local state
        setGroups(prev => prev.map(group => 
          group.id === editingGroupId 
            ? { 
                ...group, 
                ...groupData, 
                memberDetails: [...selectedUsers, { email: currentUser.email, name: currentUser.displayName || 'You' }]
              }
            : group
        ));
        // Log update activity
        try {
          await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('splitHistory')
            .add({
              type: 'update',
              groupId: editingGroupId,
              groupName: groupName,
              previousGroupName: prevGroup?.name,
              category,
              membersCount: groupData.members?.length || 0,
              createdAt: firestore.Timestamp.fromDate(new Date()),
            });
          // refresh list
          const historySnapshot = await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('splitHistory')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
          const history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSplitHistory(history);
        } catch (_) {}
        try {
          await SplitNotificationService.notifyGroupUpdated(
            { id: editingGroupId, name: groupName, category, members: [currentUser.email, ...inviteeEmails] },
            currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
            {}
          );
        } catch (_) {}
        Alert.alert('Success', 'Group updated successfully');
      } else {
        // Create new group
        groupData.createdAt = firestore.FieldValue.serverTimestamp();
        const groupRef = await firestore()
          .collection('groups')
          .add(groupData);
        // Create invitations for each selected user (by email)
        const inviterName = currentUser.displayName || currentUser.email;
        const batch = firestore().batch();
        inviteeEmails.forEach(email => {
          const inviteRef = firestore().collection('invitations').doc();
          batch.set(inviteRef, {
            email,
            groupId: groupRef.id,
            groupName: groupName,
            category,
            inviterUid: currentUser.uid,
            inviterEmail: currentUser.email,
            inviterName,
            status: 'pending',
            createdAt: firestore.Timestamp.fromDate(new Date()),
          });
        });
        await batch.commit();
        try {
          await SplitNotificationService.notifyGroupCreated(
            { id: groupRef.id, name: groupName, category, pendingInvites: inviteeEmails },
            currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone'
          );
          for (const email of inviteeEmails) {
            await SplitNotificationService.notifySplitInvite(
              { id: groupRef.id, name: groupName, category },
              currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
              email
            );
          }
        } catch (_) {}
        // Fetch member details for the new group
        const memberPromises = [{email: currentUser.email}].map(
          async user => {
            const userSnapshot = await firestore()
              .collection('users')
              .where('email', '==', user.email)
              .get();
            const data = userSnapshot.docs[0]?.data();
            if (data) {
              return { email: user.email, name: data.name || data.displayName || null, ...data };
            }
            return { email: user.email, name: memberNames[user.email] || user.name || null };
          },
        );
        const memberDetails = await Promise.all(memberPromises);
        setGroups(prev => [
          ...prev,
          {
            id: groupRef.id,
            ...groupData,
            memberDetails,
          },
        ]);
        // Log create activity
        try {
          await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('splitHistory')
            .add({
              type: 'create',
              groupId: groupRef.id,
              groupName: groupName,
              category,
              membersCount: groupData.members?.length || 0,
              createdAt: firestore.Timestamp.fromDate(new Date()),
            });
          const historySnapshot = await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('splitHistory')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
          const history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSplitHistory(history);
        } catch (_) {}
        Alert.alert('Success', 'Group created successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create/update group');
    } finally {
      // Always reset form regardless of success or failure
      setGroupName('');
      setCategory(null);
      setSelectedUsers([]);
      setIsFormVisible(false);
      setEditingGroupId(null);
    }
  };
  const deleteGroup = async groupId => {
    try {
      Alert.alert(
        'Delete Group',
        'Are you sure you want to delete this group? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // Try to fetch the group first for logging
              let groupDoc;
              try {
                groupDoc = await firestore().collection('groups').doc(groupId).get();
              } catch (_) {}
              await firestore().collection('groups').doc(groupId).delete();
              setGroups(prev => prev.filter(group => group.id !== groupId));
              // Log delete activity
              try {
                await firestore()
                  .collection('users')
                  .doc(currentUser.uid)
                  .collection('splitHistory')
                  .add({
                    type: 'delete',
                    groupId,
                    groupName: groupDoc?.data()?.name || 'Group',
                    createdAt: firestore.Timestamp.fromDate(new Date()),
                  });
                const historySnapshot = await firestore()
                  .collection('users')
                  .doc(currentUser.uid)
                  .collection('splitHistory')
                  .orderBy('createdAt', 'desc')
                  .limit(20)
                  .get();
                const history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSplitHistory(history);
              } catch (_) {}
              Alert.alert('Success', 'Group deleted successfully');
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to delete group');
    }
  };
  // Render user card
  const renderUserCard = (user, withCheckbox = false) => {
    const isSelected = selectedUsers.some(selected => selected.email === user.email);
    return (
      <View style={styles.userCard} key={user.email}>
        <UserAvatar size={50} name={user.name || user.email} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name || user.email}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.email === currentUser.email && (
            <Text style={styles.youLabel}>(You - Group Creator)</Text>
          )}
        </View>
        {withCheckbox && user.email !== currentUser.email && (
          Platform.OS === 'ios' ? (
            <TouchableOpacity 
              onPress={() => toggleUserSelection(user)}
              activeOpacity={0.7}>
              <View style={[
                styles.customCheckboxIOS,
                isSelected && styles.customCheckboxIOSSelected
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
          )
        )}
      </View>
    );
  };
  // Render group card
  const renderGroupCard = group => {
    const categoryItem = GROUP_CATEGORIES.find(
      cat => cat.value === group.category,
    );
    const GroupCardIcon = () => {
      if (categoryItem) {
        // Get the icon name from the category item based on the label
        let iconName = "account-group"; // default fallback
        switch(categoryItem.value) {
          case 'Work':
            iconName = "briefcase";
            break;
          case 'Family':
            iconName = "home-heart";
            break;
          case 'Couple':
            iconName = "heart-multiple";
            break;
          case 'Friends':
            iconName = "account-group";
            break;
          case 'Travel':
            iconName = "airplane";
            break;
          case 'Sports':
            iconName = "basketball";
            break;
          case 'Hobby':
            iconName = "palette";
            break;
          case 'Study':
            iconName = "book-open-variant";
            break;
          case 'Other':
            iconName = "dots-horizontal-circle";
            break;
        }
        return <MaterialCommunityIcons name={iconName} size={24} color="#fff" />;
      }
      // Fallback icon if category not found
      return <MaterialCommunityIcons name="account-group" size={24} color="#fff" />;
    };
    return (
      <Card key={group.id} style={styles.groupCard} elevation={2}>
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
                <GroupCardIcon />
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={styles.memberCountContainer}>
                  <MaterialCommunityIcons name="account-multiple" size={14} color="#666" />
                  <Text style={styles.groupMembers}>
                    {group.members.length} {group.members.length === 1 ? 'Member' : 'Members'}
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
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="account-group" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.headerTitle}>Split Groups</Text>
            </View>
            <Text style={styles.headerSubtitle}>Manage your expense groups</Text>
          </View>
          {/* Create Group Card */}
          <Card style={styles.createGroupCard} elevation={2}>
            <View style={styles.cardContent}>
              <TouchableOpacity
                style={styles.createGroupHeader}
                activeOpacity={0.7}
                onPress={() => {
                  if (!isFormVisible) {
                    // When opening form for new group creation, ensure we're not in edit mode
                    setEditingGroupId(null);
                    setGroupName('');
                    setCategory(null);
                    setSelectedUsers([]);
                  }
                  setIsFormVisible(!isFormVisible);
                }}
              >
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
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <DropDownPicker
                      open={openCategoryDropdown}
                      value={category}
                      items={GROUP_CATEGORIES}
                      setOpen={setOpenCategoryDropdown}
                      setValue={setCategory}
                      placeholder="Select Group Category"
                      style={styles.dropdown}
                      dropDownContainerStyle={styles.dropdownContainer}
                      searchable={true}
                      searchPlaceholder="Search categories..."
                      listMode="MODAL"
                      modalTitle="Select Group Category"
                      modalAnimationType="slide"
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
                  {userDetails && userDetails.email !== currentUser.email && renderUserCard(userDetails, true)}
                  {userDetails && userDetails.email === currentUser.email && (
                    <View style={styles.warningCard}>
                      <Text style={styles.warningText}>
                        ⚠️ You cannot add yourself to the group. You are automatically included.
                      </Text>
                    </View>
                  )}
                  <View style={styles.selectedContainer}>
                    <Text style={styles.selectedUsersLabel}>Selected Users:</Text>
                    {selectedUsers.map(user => renderUserCard(user, true))}
                    {selectedUsers.length === 0 && (
                      <Text style={styles.emptySelectionText}>
                        No users selected yet. Search and add members above.
                      </Text>
                    )}
                  </View>
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.createGroupButton}
                      onPress={createGroup}>
                      <Text style={styles.createGroupButtonText}>
                        {editingGroupId ? 'Update Group' : 'Create Group'}
                      </Text>
                      <MaterialCommunityIcons name={editingGroupId ? "pencil" : "check"} size={20} color="#fff" />
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
                        <MaterialCommunityIcons name="close" size={20} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          </Card>
          {/* Groups List */}
          <View style={styles.groupsSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text
                style={[styles.sectionTitle, { marginBottom: 0, flexShrink: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Your Groups
              </Text>
              <View style={styles.groupsHeaderActions}>
                <TouchableOpacity
                  style={styles.iconActionButton}
                  onPress={() => navigation.navigate('Invitations')}
                >
                  <MaterialCommunityIcons name="account-multiple-plus-outline" size={20} color="#FFFFFF" />
                  {invitationsCount > 0 && (
                    <View style={{
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
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }} numberOfLines={1}>
                        {invitationsCount > 99 ? '99+' : String(invitationsCount)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconActionButton}
                  onPress={() => navigation.navigate('SplitHistory')}
                >
                  <MaterialCommunityIcons name="history" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            {groups.length === 0 ? (
              <Card style={styles.emptyStateCard} elevation={1}>
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="account-group-outline" size={64} color="#CBD3EE" />
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
  createGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {
    padding: 25,
  },
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
  toggleButton: {
    padding: 5,
  },
  formContainer: {
    marginTop: 20,
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
  dropdown: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
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
  nameInputContainer: {
    marginTop: 8,
  },
  nameInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  addUserButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addUserButtonSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
  selectedContainer: {
    marginTop: 15,
  },
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
  warningText: {
    fontSize: 14,
    color: '#E65100',
    fontFamily: 'Lato-Regular',
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 1,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 1,
    },
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
  groupsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 15,
  },
  groupCardContent: {
    padding: 22,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupInfo: {
    marginLeft: 12,
    flex: 1,
  },
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
  groupCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editGroupButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteGroupButton: {
    padding: 8,
    marginRight: 8,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedGroupDetails: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8EBF7',
  },
  membersSection: {
    marginBottom: 20,
  },
  expandedDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  memberAvatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  memberAvatarWrapper: {
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
    width: 60,
  },
  memberAvatar: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  memberNameText: {
    fontSize: 12,
    fontFamily: 'Lato-Regular',
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  moreMembersIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8EBF7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  moreMembersText: {
    fontSize: 11,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  groupMetaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontFamily: 'Lato-Regular',
  },
  groupDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  expandedDetailText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  viewGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
    fontFamily: 'Lato-Bold',
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
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
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
  categoryIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  dropdown: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
    marginVertical: 10,
    borderRadius: 10,
    zIndex: 1000,
  },
  dropdownContainer: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#fff',
    borderRadius: 10,
    zIndex: 1000,
  },
  createGroupButton: {
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  createGroupButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 10,
  },
});
export default SplitScreen;
