import React, {useState, useEffect} from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
} from 'react-native';
import {Text, Provider, Checkbox, Card, ActivityIndicator} from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from 'react-native-user-avatar';
import DropDownPicker from 'react-native-dropdown-picker';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

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

const SplitScreen = ({navigation}) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [category, setCategory] = useState(null);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUser = auth().currentUser;

  // Fetch user's groups
  useEffect(() => {
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

              return userSnapshot.docs[0]?.data() || {email};
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
        console.error('Error fetching groups:', error);
        Alert.alert('Error', 'Failed to fetch groups');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [currentUser]);

  // Fetch user by email or phone
  const fetchUserByEmailOrPhone = async query => {
    try {
      // Check if query is a phone number (contains only digits)
      const isPhoneNumber = /^\d+$/.test(query);
      
      let userSnapshot;
      if (isPhoneNumber) {
        // Search by phone number with exact match
        userSnapshot = await firestore()
          .collection('users')
          .where('phone', '==', query)
          .get();
      } else if (query.includes('@')) {
        // Search by email
        userSnapshot = await firestore()
          .collection('users')
          .where('email', '==', query.trim())
          .get();
      }

      if (!userSnapshot.empty) {
        const user = userSnapshot.docs[0].data();
        setUserDetails(user);
      } else {
        setUserDetails({name: 'Not Registered', email: query});
      }
    } catch (error) {
      console.error('Error fetching user:', error);
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

    setSelectedUsers(prev => {
      const isSelected = prev.some(selected => selected.email === user.email);
      if (isSelected) {
        return prev.filter(selected => selected.email !== user.email);
      } else {
        return [...prev, user];
      }
    });
  };

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
      console.error('Error preparing group edit:', error);
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
      const groupData = {
        name: groupName,
        category: category,
        members: [
          ...selectedUsers.map(user => user.email),
          currentUser.email,
        ],
        createdBy: currentUser.uid,
        updatedAt: firestore.FieldValue.serverTimestamp(),
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
            ? { ...group, ...groupData, memberDetails: [...selectedUsers, { email: currentUser.email, name: currentUser.displayName || 'You' }] }
            : group
        ));

        Alert.alert('Success', 'Group updated successfully');
      } else {
        // Create new group
        groupData.createdAt = firestore.FieldValue.serverTimestamp();
        const groupRef = await firestore()
          .collection('groups')
          .add(groupData);

        // Fetch member details for the new group
        const memberPromises = [...selectedUsers, {email: currentUser.email}].map(
          async user => {
            const userSnapshot = await firestore()
              .collection('users')
              .where('email', '==', user.email)
              .get();

            return userSnapshot.docs[0]?.data() || user;
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

        Alert.alert('Success', 'Group created successfully');
      }
    } catch (error) {
      console.error('Error creating/updating group:', error);
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
              await firestore().collection('groups').doc(groupId).delete();

              setGroups(prev => prev.filter(group => group.id !== groupId));

              Alert.alert('Success', 'Group deleted successfully');
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', 'Failed to delete group');
    }
  };

  // Render user card
  const renderUserCard = (user, withCheckbox = false) => (
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
        <Checkbox
          status={
            selectedUsers.some(selected => selected.email === user.email)
              ? 'checked'
              : 'unchecked'
          }
          onPress={() => toggleUserSelection(user)}
        />
      )}
    </View>
  );

  // Render group card
  const renderGroupCard = group => {
    const categoryItem = GROUP_CATEGORIES.find(
      cat => cat.value === group.category,
    );
    const isExpanded = expandedGroupId === group.id;

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
      <Card key={group.id} style={styles.groupCard}>
        <TouchableOpacity
          style={styles.groupCardContent}
          onPress={() => setExpandedGroupId(isExpanded ? null : group.id)}>
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
            <View style={styles.groupCardRight}>
              <TouchableOpacity
                style={styles.editGroupButton}
                onPress={e => {
                  e.stopPropagation();
                  handleEditGroup(group);
                }}>
                <MaterialCommunityIcons
                  name="pencil"
                  size={18}
                  color={PRIMARY_COLOR}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteGroupButton}
                onPress={e => {
                  e.stopPropagation();
                  deleteGroup(group.id);
                }}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={18}
                  color={EXPENSE_COLOR}
                />
              </TouchableOpacity>
              <MaterialCommunityIcons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={24}
                color="#666"
              />
            </View>
          </View>

          {isExpanded && (
            <View style={styles.expandedGroupDetails}>
              <View style={styles.membersSection}>
                <Text style={styles.expandedDetailTitle}>Members</Text>
                <View style={styles.memberAvatarsContainer}>
                  {group.memberDetails.slice(0, 4).map((member, index) => (
                    <View key={member.email} style={styles.memberAvatarWrapper}>
                      <UserAvatar 
                        size={36} 
                        name={member.name || member.email} 
                        bgColor={PRIMARY_COLOR}
                        style={styles.memberAvatar}
                      />
                      <Text style={styles.memberNameText} numberOfLines={1}>
                        {member.name || member.email.split('@')[0]}
                      </Text>
                    </View>
                  ))}
                  {group.memberDetails.length > 4 && (
                    <View style={styles.moreMembersIndicator}>
                      <Text style={styles.moreMembersText}>
                        +{group.memberDetails.length - 4}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.groupMetaInfo}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="tag" size={16} color="#666" />
                  <Text style={styles.metaText}>{group.category}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="calendar" size={16} color="#666" />
                  <Text style={styles.metaText}>
                    {group.createdAt
                      ? new Date(group.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : 'Unknown Date'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.viewGroupButton}
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
                <MaterialCommunityIcons name="eye" size={18} color="#FFFFFF" />
                <Text style={styles.viewGroupButtonText}>View Group Details</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
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
          <Card style={styles.createGroupCard}>
            <View style={styles.cardContent}>
              <View style={styles.createGroupHeader}>
                <Text style={styles.createGroupTitle}>
                  {editingGroupId ? 'Edit Group' : 'Create New Group'}
                </Text>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => {
                    if (!isFormVisible) {
                      // When opening form for new group creation, ensure we're not in edit mode
                      setEditingGroupId(null);
                      setGroupName('');
                      setCategory(null);
                      setSelectedUsers([]);
                    }
                    setIsFormVisible(!isFormVisible);
                  }}>
                  <MaterialCommunityIcons
                    name={isFormVisible ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={PRIMARY_COLOR}
                  />
                </TouchableOpacity>
              </View>

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
            <Text style={styles.sectionTitle}>Your Groups</Text>
            {groups.length === 0 ? (
              <Card style={styles.emptyStateCard}>
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
    elevation: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
    elevation: 3,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
    elevation: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    elevation: 2,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
