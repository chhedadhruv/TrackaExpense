import React, {useState, useEffect} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  Dimensions,
  TextInput,
} from 'react-native';
import {Text, ProgressBar, Provider, Checkbox} from 'react-native-paper';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AntDesign from 'react-native-vector-icons/AntDesign';
import DropDownPicker from 'react-native-dropdown-picker';
import UserAvatar from 'react-native-user-avatar';
import Feather from 'react-native-vector-icons/Feather';

const {width} = Dimensions.get('window');
const PRIMARY_COLOR = '#677CD2';
const SECONDARY_COLOR = '#7A8EE0';
const BACKGROUND_COLOR = '#F4F6FA';

const CATEGORY_OPTIONS = [
  {
    label: 'Emergency Fund',
    value: 'Emergency',
    icon: () => <Feather name="alert-circle" size={24} color={PRIMARY_COLOR} />,
  },
  {
    label: 'Investment',
    value: 'Investment',
    icon: () => <Feather name="trending-up" size={24} color={PRIMARY_COLOR} />,
  },
  {
    label: 'Personal',
    value: 'Personal',
    icon: () => <Feather name="user" size={24} color={PRIMARY_COLOR} />,
  },
  {
    label: 'Travel',
    value: 'Travel',
    icon: () => <Feather name="map" size={24} color={PRIMARY_COLOR} />,
  },
];

const GROUP_CATEGORIES = [
  {
    label: 'Couple',
    value: 'Couple',
    icon: () => <Feather name="heart" size={24} color={PRIMARY_COLOR} />,
  },
  {
    label: 'Family',
    value: 'Family',
    icon: () => <Feather name="home" size={24} color={PRIMARY_COLOR} />,
  },
  {
    label: 'Friends',
    value: 'Friends',
    icon: () => <Feather name="users" size={24} color={PRIMARY_COLOR} />,
  },
  {
    label: 'Work',
    value: 'Work',
    icon: () => <Feather name="briefcase" size={24} color={PRIMARY_COLOR} />,
  },
  {
    label: 'Project',
    value: 'Project',
    icon: () => <Feather name="target" size={24} color={PRIMARY_COLOR} />,
  },
];

const SavingScreen = ({navigation}) => {
  // Existing states
  const [amount, setAmount] = useState('');
  const [savingGoal, setSavingGoal] = useState('');
  const [category, setCategory] = useState(null);
  const [targetAmount, setTargetAmount] = useState('');
  const [savingsList, setSavingsList] = useState([]);
  const [error, setError] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [open, setOpen] = useState(false);

  // New states for collaborative features
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupCategory, setGroupCategory] = useState(null);
  const [openGroupCategory, setOpenGroupCategory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [mySavingGroups, setMySavingGroups] = useState([]);

  const currentUser = auth().currentUser;

  // Fetch user's saving groups
  useEffect(() => {
    if (currentUser) {
      const unsubscribe = firestore()
        .collection('savingGroups')
        .where('members', 'array-contains', currentUser.email)
        .onSnapshot(
          snapshot => {
            const groupsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            setMySavingGroups(groupsData);
          },
          error => {
            console.error('Error fetching saving groups:', error);
          },
        );

      return () => unsubscribe();
    }
  }, [currentUser]);

  // Fetch savings with group filter
  useEffect(() => {
    if (currentUser) {
      const unsubscribe = firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('savings')
        .onSnapshot(
          snapshot => {
            const savingsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            setSavingsList(savingsData);
          },
          error => {
            setError('Error fetching savings data');
            console.error(error);
          },
        );

      return () => unsubscribe();
    }
  }, [currentUser]);

  // Fetch user by email
  const fetchUserByEmail = async email => {
    try {
      const userSnapshot = await firestore()
        .collection('users')
        .where('email', '==', email.trim())
        .get();

      if (!userSnapshot.empty) {
        const user = userSnapshot.docs[0].data();
        setUserDetails(user);
      } else {
        setUserDetails({name: 'Not Registered', email});
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      Alert.alert('Error', 'Failed to fetch user');
    }
  };

  // Toggle user selection
  const toggleUserSelection = user => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(selected => selected.email === user.email);
      if (isSelected) {
        return prev.filter(selected => selected.email !== user.email);
      } else {
        return [...prev, user];
      }
    });
  };

  // Create saving group
  const createSavingGroup = async () => {
    if (!groupName.trim() || !groupCategory || selectedUsers.length === 0) {
      Alert.alert('Validation Error', 'Please fill in all group details');
      return;
    }

    try {
      const groupRef = await firestore().collection('savingGroups').add({
        name: groupName,
        category: groupCategory,
        members: [...selectedUsers.map(user => user.email), currentUser.email],
        createdBy: currentUser.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        totalSaved: 0,
        targetAmount: parseFloat(targetAmount) || 0,
      });

      Alert.alert('Success', 'Saving group created successfully');
      resetGroupForm();
    } catch (error) {
      console.error('Error creating saving group:', error);
      Alert.alert('Error', 'Failed to create saving group');
    }
  };

  // Handle saving with group sync
  const validateInputs = () => {
    if (!savingGoal.trim()) {
      Alert.alert('Error', 'Please enter a saving goal');
      return false;
    }
    if (!targetAmount || isNaN(parseFloat(targetAmount)) || parseFloat(targetAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid target amount');
      return false;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
      Alert.alert('Error', 'Please enter a valid current amount');
      return false;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    if (isCollaborative) {
      if (!groupName.trim()) {
        Alert.alert('Error', 'Please enter a group name');
        return false;
      }
      if (!groupCategory) {
        Alert.alert('Error', 'Please select a group category');
        return false;
      }
      if (selectedUsers.length === 0) {
        Alert.alert('Error', 'Please select at least one user to collaborate with');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;

    try {
      // Show loading indicator (you might want to add a loading state)
      setError('');

      let groupId = null;
      if (isCollaborative) {
        // Create group first
        const groupRef = await firestore().collection('savingGroups').add({
          name: groupName,
          category: groupCategory,
          members: [...selectedUsers.map(user => user.email), currentUser.email],
          createdBy: currentUser.uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
          totalSaved: parseFloat(amount) || 0,
          targetAmount: parseFloat(targetAmount) || 0,
          goal: savingGoal, // Add the goal to the group document as well
        });

        groupId = groupRef.id;

        // Create saving goals for all group members
        const members = [...selectedUsers.map(user => user.email), currentUser.email];
        const batch = firestore().batch();

        for (const memberEmail of members) {
          const userSnapshot = await firestore()
            .collection('users')
            .where('email', '==', memberEmail)
            .get();

          if (!userSnapshot.empty) {
            const userId = userSnapshot.docs[0].id;
            const savingRef = firestore()
              .collection('users')
              .doc(userId)
              .collection('savings')
              .doc();

            batch.set(savingRef, {
              goal: savingGoal,
              category: category,
              targetAmount: parseFloat(targetAmount),
              currentAmount: parseFloat(amount),
              progressPercentage: Math.round(
                (parseFloat(amount) / parseFloat(targetAmount)) * 100,
              ),
              createdAt: firestore.FieldValue.serverTimestamp(),
              isCollaborative: true,
              groupId: groupId,
              groupName: groupName,
              groupCategory: groupCategory,
            });
          }
        }

        // Commit the batch
        await batch.commit();
      } else {
        // Create individual saving goal
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .collection('savings')
          .add({
            goal: savingGoal,
            category: category,
            targetAmount: parseFloat(targetAmount),
            currentAmount: parseFloat(amount),
            progressPercentage: Math.round(
              (parseFloat(amount) / parseFloat(targetAmount)) * 100,
            ),
            createdAt: firestore.FieldValue.serverTimestamp(),
            isCollaborative: false,
          });
      }

      Alert.alert(
        'Success',
        isCollaborative
          ? 'Group and saving goal created successfully'
          : 'Saving goal added successfully',
      );
      resetForm();
    } catch (error) {
      console.error('Error saving goal:', error);
      setError(error.message || 'Error saving goal. Please try again.');
      Alert.alert('Error', 'Failed to save saving goal. Please try again.');
    }
  };

  // Reset forms
  const resetForm = () => {
    setAmount('');
    setSavingGoal('');
    setCategory(null);
    setTargetAmount('');
    setIsFormVisible(false);
    setIsCollaborative(false);
    resetGroupForm();
  };

  const resetGroupForm = () => {
    setGroupName('');
    setGroupCategory(null);
    setSelectedUsers([]);
    setSearchQuery('');
    setUserDetails(null);
  };

  const handleDeleteSaving = async (savingId, groupId = null) => {
    try {
      Alert.alert(
        'Confirm Delete',
        'Are you sure you want to delete this saving goal?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (groupId) {
                // Delete group and all associated savings
                const groupDoc = await firestore()
                  .collection('savingGroups')
                  .doc(groupId)
                  .get();

                if (groupDoc.exists) {
                  const groupData = groupDoc.data();
                  
                  // Check if current user is the creator
                  if (groupData.createdBy !== currentUser.uid) {
                    Alert.alert('Error', 'Only the group creator can delete the group');
                    return;
                  }

                  // Delete savings for all members
                  const batch = firestore().batch();
                  
                  for (const memberEmail of groupData.members) {
                    const userSnapshot = await firestore()
                      .collection('users')
                      .where('email', '==', memberEmail)
                      .get();

                    if (!userSnapshot.empty) {
                      const userId = userSnapshot.docs[0].id;
                      const savingsSnapshot = await firestore()
                        .collection('users')
                        .doc(userId)
                        .collection('savings')
                        .where('groupId', '==', groupId)
                        .get();

                      savingsSnapshot.docs.forEach((doc) => {
                        batch.delete(doc.ref);
                      });
                    }
                  }

                  // Delete the group
                  batch.delete(firestore().collection('savingGroups').doc(groupId));

                  // Commit the batch
                  await batch.commit();
                  Alert.alert('Success', 'Group and associated savings deleted successfully');
                }
              } else {
                // Delete individual saving
                await firestore()
                  .collection('users')
                  .doc(currentUser.uid)
                  .collection('savings')
                  .doc(savingId)
                  .delete();
                Alert.alert('Success', 'Saving goal deleted successfully');
              }
            },
          },
        ],
        {cancelable: true},
      );
    } catch (error) {
      console.error('Error deleting saving:', error);
      Alert.alert('Error', 'Failed to delete saving goal');
    }
  };

  // Render user card
  const renderUserCard = (user, withCheckbox = false) => (
    <View style={styles.userCard} key={user.email}>
      <UserAvatar size={50} name={user.name || user.email} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name || user.email}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>
      {withCheckbox && (
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

  // Render saving item with group info
  const renderSavingItem = ({item}) => {
    const progressColor = item.progressPercentage < 50 ? '#FF6B6B' : SECONDARY_COLOR;

    return (
      <View style={styles.savingCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.savingGoal} numberOfLines={1}>
            {item.goal}
          </Text>
          <View style={styles.badgeContainer}>
            {item.isCollaborative && (
              <View style={[styles.categoryBadge, styles.collaborativeBadge]}>
                <Text style={styles.badgeText}>Group</Text>
              </View>
            )}
            <View style={styles.categoryBadge}>
              <Text style={styles.badgeText}>{item.category}</Text>
            </View>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <Text style={styles.amountText}>
            {item.currentAmount} / {item.targetAmount}
          </Text>
          <ProgressBar
            progress={item.progressPercentage / 100}
            color={progressColor}
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {item.progressPercentage}% Complete
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.cardButton, styles.editButton]}
            onPress={() =>
              navigation.navigate('EditSaving', {
                savingId: item.id,
                isCollaborative: item.isCollaborative,
              })
            }>
            <Feather name="edit" size={16} color="#fff" />
            <Text style={styles.buttonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardButton, styles.deleteButton]}
            onPress={() => handleDeleteSaving(item.id, item.groupId)}>
            <Feather name="trash-2" size={16} color="#fff" />
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Provider>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Your Savings Goals</Text>
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

          {error && <Text style={styles.errorText}>{error}</Text>}

          {isFormVisible && (
            <View style={styles.formContainer}>
              <View style={styles.collaborativeToggle}>
                <Text style={styles.collaborativeText}>Make it collaborative</Text>
                <Checkbox
                  status={isCollaborative ? 'checked' : 'unchecked'}
                  onPress={() => setIsCollaborative(!isCollaborative)}
                />
              </View>

              <FormInput
                labelValue={savingGoal}
                placeholderText="Enter saving goal"
                iconType="star"
                onChangeText={setSavingGoal}
              />
              <FormInput
                labelValue={targetAmount}
                placeholderText="Target amount"
                iconType="creditcard"
                onChangeText={setTargetAmount}
                keyboardType="numeric"
              />
              <FormInput
                labelValue={amount}
                placeholderText="Current amount"
                iconType="creditcard"
                onChangeText={setAmount}
                keyboardType="numeric"
              />

              <DropDownPicker
                open={open}
                value={category}
                items={CATEGORY_OPTIONS}
                setOpen={setOpen}
                setValue={setCategory}
                placeholder="Select Category"
                style={styles.dropdown}
                dropDownContainerStyle={styles.dropdownContainer}
                searchable={true}
                searchPlaceholder="Search categories..."
                listMode="MODAL"
                modalTitle="Select Saving Category"
                modalAnimationType="slide"
                zIndex={3000}
              />

              {isCollaborative && (
                <View style={styles.groupSection}>
                  <Text style={styles.sectionHeader}>Group Details</Text>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Enter group name"
                    placeholderTextColor="#999"
                    value={groupName}
                    onChangeText={setGroupName}
                  />

                  <DropDownPicker
                    open={openGroupCategory}
                    value={groupCategory}
                    items={GROUP_CATEGORIES}
                    setOpen={setOpenGroupCategory}
                    setValue={setGroupCategory}
                    placeholder="Select Group Category"
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownContainer}
                    searchable={true}
                    searchPlaceholder="Search categories..."
                    listMode="MODAL"
                    modalTitle="Select Group Category"
                    modalAnimationType="slide"
                    zIndex={2000}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Search user by email"
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={email => {
                      setSearchQuery(email);
                      if (email.includes('@')) {
                        fetchUserByEmail(email);
                      }
                    }}
                  />

                  {userDetails && renderUserCard(userDetails, true)}

                  {selectedUsers.length > 0 && (
                    <View style={styles.selectedContainer}>
                      <Text style={styles.sectionHeader}>Selected Users:</Text>
                      {selectedUsers.map(user => renderUserCard(user, true))}
                    </View>
                  )}
                </View>
              )}

              <FormButton
                buttonTitle={isCollaborative ? "Create Group & Save" : "Save Goal"}
                onPress={handleSave}
                style={[styles.saveButton, {marginTop: 20}]}
              />
            </View>
          )}

{savingsList.length === 0 ? (
            <View style={styles.emptyState}>
              <AntDesign name="inbox" size={64} color={PRIMARY_COLOR} />
              <Text style={styles.emptyStateText}>
                No savings goals yet. Start tracking your goals!
              </Text>
            </View>
          ) : (
            <FlatList
              data={savingsList}
              renderItem={renderSavingItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 15,
  },
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
    zIndex: 1000, // Add this to handle dropdown overlap
  },
  groupSection: {
    marginTop: 15,
    padding: 15,
    backgroundColor: 'rgba(103, 124, 210, 0.1)',
    borderRadius: 10,
    zIndex: 1000, // Add this to handle dropdown overlap
  },
  dropdown: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
    marginVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  dropdownContainer: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  saveButton: {
    width: width - 60,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // marginHorizontal: 20,
    zIndex: 1, // Lower zIndex for button
  },
  savingCard: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
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
    marginBottom: 10,
  },
  savingGoal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    color: '#fff',
    fontSize: 12,
  },
  progressContainer: {
    marginVertical: 10,
  },
  amountText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'right',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 5,
  },
  viewButton: {
    backgroundColor: SECONDARY_COLOR,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: SECONDARY_COLOR,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyStateText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold',
  },
  collaborativeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: PRIMARY_COLOR,
    zIndex: 1, // Lower zIndex for toggle
  },
  collaborativeText: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  groupSection: {
    marginTop: 15,
    padding: 15,
    backgroundColor: 'rgba(103, 124, 210, 0.1)',
    borderRadius: 10,
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
    zIndex: 1, // Lower zIndex for input
  },
  groupHeader: {
    marginTop: 20,
  },
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
  selectedContainer: {
    marginTop: 15,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaborativeBadge: {
    marginRight: 8,
    backgroundColor: SECONDARY_COLOR,
  },
  emptyGroupState: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(103, 124, 210, 0.1)',
    borderRadius: 15,
    marginTop: 10,
  },
  listContainer: {
    paddingBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    flex: 0.48,
  },
  editButton: {
    backgroundColor: SECONDARY_COLOR,
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
  collaborativeBadge: {
    backgroundColor: SECONDARY_COLOR,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sectionHeader: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default SavingScreen;