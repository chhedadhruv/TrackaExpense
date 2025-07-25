import React, {useState, useEffect} from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {Text, Provider, Checkbox} from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AntDesign from 'react-native-vector-icons/AntDesign';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from 'react-native-user-avatar';
import DropDownPicker from 'react-native-dropdown-picker';

const PRIMARY_COLOR = '#677CD2';
const SECONDARY_COLOR = '#7A8EE0';
const BACKGROUND_COLOR = '#F4F6FA';

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

      // Reset form
      setGroupName('');
      setCategory(null);
      setSelectedUsers([]);
      setIsFormVisible(false);
      setEditingGroupId(null);
    } catch (error) {
      console.error('Error creating/updating group:', error);
      Alert.alert('Error', 'Failed to create/update group');
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
      const IconComponent = () => categoryItem?.icon();
      return IconComponent
        ? React.cloneElement(IconComponent(), {color: '#fff'})
        : null;
    };

    return (
      <TouchableOpacity
        style={styles.groupCard}
        key={group.id}
        onPress={() => setExpandedGroupId(isExpanded ? null : group.id)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.categoryIconContainer}>
              <GroupCardIcon />
            </View>
            <Text style={styles.groupName}>{group.name}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.groupMembers}>
              {group.members.length} Members
            </Text>
            <View style={styles.groupActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={e => {
                  e.stopPropagation();
                  handleEditGroup(group);
                }}>
                <MaterialCommunityIcons
                  name="pencil"
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={e => {
                  e.stopPropagation();
                  deleteGroup(group.id);
                }}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {isExpanded && (
          <TouchableOpacity
            style={styles.expandedGroupDetails}
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
            <Text style={styles.expandedDetailTitle}>Members:</Text>
            <View style={styles.memberPreviewContainer}>
              {group.memberDetails.slice(0, 3).map((member, index) => (
                <View key={member.email} style={styles.memberPreview}>
                  <UserAvatar size={30} name={member.name || member.email} />
                  <Text style={styles.memberPreviewName} numberOfLines={1}>
                    {member.name || member.email}
                  </Text>
                </View>
              ))}
              {group.memberDetails.length > 3 && (
                <Text style={styles.moreMembersText}>
                  +{group.memberDetails.length - 3} more
                </Text>
              )}
            </View>

            <View style={styles.groupDetailsRow}>
              <Text style={styles.expandedDetailText}>
                Category: {group.category}
              </Text>
              <Text style={styles.expandedDetailText}>
                Created:{' '}
                {group.createdAt
                  ? new Date(
                      group.createdAt.seconds * 1000,
                    ).toLocaleDateString()
                  : 'Unknown Date'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Provider>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Create Group</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setIsFormVisible(!isFormVisible)}>
              <AntDesign
                name={isFormVisible ? 'close' : 'plus'}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {isFormVisible && (
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter group name"
                placeholderTextColor="#999"
                value={groupName}
                onChangeText={setGroupName}
              />

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

              <TextInput
                style={styles.input}
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

              {userDetails && userDetails.email !== currentUser.email && renderUserCard(userDetails, true)}
              {userDetails && userDetails.email === currentUser.email && (
                <View style={styles.warningCard}>
                  <Text style={styles.warningText}>
                    ⚠️ You cannot add yourself to the group. You are automatically included.
                  </Text>
                </View>
              )}

              <View style={styles.selectedContainer}>
                <Text style={styles.sectionHeader}>Selected Users:</Text>
                {selectedUsers.map(user => renderUserCard(user, true))}
                {selectedUsers.length === 0 && (
                  <Text style={styles.emptySelectionText}>
                    No users selected yet. Search and add members above.
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.createGroupButton}
                onPress={createGroup}>
                <Text style={styles.createGroupButtonText}>
                  {editingGroupId ? 'Update Group' : 'Create Group'}
                </Text>
                <AntDesign name={editingGroupId ? "edit" : "save"} size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.groupsSection}>
            <Text style={styles.sectionHeader}>Your Groups:</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={styles.loadingText}>Loading groups...</Text>
              </View>
            ) : groups.length === 0 ? (
              <View style={styles.emptyState}>
                <AntDesign name="team" size={64} color={PRIMARY_COLOR} />
                <Text style={styles.emptyStateText}>
                  No groups created yet. Start connecting!
                </Text>
              </View>
            ) : (
              groups.map(renderGroupCard)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Provider>
  );
};

const styles = StyleSheet.create({
  // Container and Layout Styles
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 15,
  },

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Form Container Styles
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 15,
    marginBottom: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
  },

  // User Card Styles
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  userEmail: {
    fontSize: 14,
    color: SECONDARY_COLOR,
  },

  // Selected Users Section
  selectedContainer: {
    marginTop: 10,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 10,
  },

  // Groups Section
  groupsSection: {
    marginTop: 10,
  },
  groupCard: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 10,
    padding: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  groupMembers: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    color: '#fff',
    fontSize: 12,
  },

  // Empty State Styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
  },
  emptyStateText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
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
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expandedGroupDetails: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 10,
  },
  expandedDetailTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  memberPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  memberPreview: {
    alignItems: 'center',
    marginRight: 10,
  },
  memberPreviewName: {
    color: '#fff',
    fontSize: 10,
    marginTop: 5,
    maxWidth: 60,
  },
  moreMembersText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  groupDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  expandedDetailText: {
    color: '#fff',
    fontSize: 12,
  },
  categoryIconContainer: {
    marginRight: 10,
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    marginLeft: 10,
    padding: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '500',
  },
  youLabel: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  warningCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginVertical: 10,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  emptySelectionText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});

export default SplitScreen;
