import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {Card, Checkbox, ActivityIndicator, Switch} from 'react-native-paper';
import DropDownPicker from 'react-native-dropdown-picker';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import FormButton from '../../components/FormButton';
import {DatePickerModal} from 'react-native-paper-dates';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const {width} = Dimensions.get('window');
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

// Category Options
const CATEGORY_OPTIONS = [
  {
    label: 'Groceries & Food',
    value: 'Groceries',
    icon: 'cart-variant',
  },
  {
    label: 'Restaurant & Dining',
    value: 'Restaurant',
    icon: 'silverware-fork-knife',
  },
  {
    label: 'Gas & Fuel',
    value: 'Gas',
    icon: 'gas-station',
  },
  {
    label: 'Public Transport',
    value: 'PublicTransport',
    icon: 'bus',
  },
  {
    label: 'Electricity Bill',
    value: 'Electricity',
    icon: 'lightning-bolt',
  },
  {
    label: 'Water Bill',
    value: 'Water',
    icon: 'water',
  },
  {
    label: 'Internet & Phone',
    value: 'Internet',
    icon: 'wifi',
  },
  {
    label: 'Movies & Entertainment',
    value: 'Entertainment',
    icon: 'movie-open',
  },
  {
    label: 'Travel & Hotels',
    value: 'Travel',
    icon: 'airplane',
  },
  {
    label: 'Shopping & Retail',
    value: 'Shopping',
    icon: 'shopping',
  },
  {
    label: 'Rent & Housing',
    value: 'Housing',
    icon: 'home',
  },
  {
    label: 'Medical & Healthcare',
    value: 'Healthcare',
    icon: 'hospital-box',
  },
  {
    label: 'Fitness & Sports',
    value: 'Fitness',
    icon: 'dumbbell',
  },
  {
    label: 'Education & Books',
    value: 'Education',
    icon: 'book-open-variant',
  },
  {
    label: 'Maintenance & Repairs',
    value: 'Maintenance',
    icon: 'tools',
  },
];

const CreateSplitScreen = ({route, navigation}) => {
  const [isSplitByPercentage, setIsSplitByPercentage] = useState(false);
  const {group, split} = route.params || {};
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [selectedPercentages, setSelectedPercentages] = useState({});
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(null);
  const [openCategory, setOpenCategory] = useState(false);
  const [splitType, setSplitType] = useState('equal'); // Changed from isSplitByPercentage to splitType
  const [date, setDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const isEditMode = !!split;

  useEffect(() => {
    if (!group || !group.id) {
      Alert.alert('Error', 'Group information is missing');
      navigation.goBack();
      return;
    }

    fetchGroupMembers();
  }, [group]);

  useEffect(() => {
    // Pre-fill form if in edit mode
    if (isEditMode && groupMembers.length > 0) {
      setTitle(split.title);
      setAmount(split.amount.toString());
      setCategory(split.category);
      setDate(split.date?.toDate() || split.createdAt.toDate());

      // Set paid by
      const paidByMember = groupMembers.find(
        member => member.email === split.paidBy.email,
      );
      setPaidBy(paidByMember);

      // Determine split type with backward compatibility
      const splitType =
        split.splitType ||
        (split.splitUsers.some(user => user.percentage)
          ? 'percentage'
          : 'equal');

      // Set split type
      setIsSplitByPercentage(splitType === 'percentage');

      // Set selected users and percentages
      const initialSelectedUsers = {};
      const initialSelectedPercentages = {};
      groupMembers.forEach(member => {
        const splitUser = split.splitUsers.find(
          user => user.email === member.email,
        );
        initialSelectedUsers[member.email] = true; // Set all to true by default
        initialSelectedPercentages[member.email] = splitUser?.percentage
          ? splitUser.percentage.toString()
          : (100 / groupMembers.length).toFixed(2);
      });

      setSelectedUsers(initialSelectedUsers);
      setSelectedPercentages(initialSelectedPercentages);
    }
  }, [split, groupMembers]);

  const fetchGroupMembers = async () => {
    try {
      const groupDoc = await firestore()
        .collection('groups')
        .doc(group.id)
        .get();
      const membersData = groupDoc.data()?.members || [];

      const memberPromises = membersData.map(async email => {
        const userSnapshot = await firestore()
          .collection('users')
          .where('email', '==', email)
          .get();

        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          return {
            email,
            name: userData.name || userData.displayName || email.split('@')[0],
            userId: userSnapshot.docs[0].id,
            ...userData,
          };
        }

        return {
          email,
          name: email.split('@')[0],
          userId: null,
        };
      });

      const formattedMembers = await Promise.all(memberPromises);

      // Initialize all users as selected with equal percentages
      const initialSelectedUsers = {};
      const initialSelectedPercentages = {};
      const defaultPercentage = (100 / formattedMembers.length).toFixed(2);

      formattedMembers.forEach(member => {
        initialSelectedUsers[member.email] = true; // Set all to true by default
        initialSelectedPercentages[member.email] = defaultPercentage;
      });

      setGroupMembers(formattedMembers);
      setSelectedUsers(initialSelectedUsers);
      setSelectedPercentages(initialSelectedPercentages);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching group members:', error);
      Alert.alert('Error', 'Failed to load group members');
      navigation.goBack();
    }
  };

  const toggleUserSelection = userEmail => {
    setSelectedUsers(prev => ({
      ...prev,
      [userEmail]: !prev[userEmail],
    }));
  };

  const onDismissDatePicker = () => {
    setDatePickerVisible(false);
  };

  const onConfirmDate = params => {
    setDatePickerVisible(false);
    setDate(params.date);
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!title) {
      Alert.alert('Validation Error', 'Please enter a split title');
      return;
    }

    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
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

    // Validate selections based on split type
    const selectedUsersList = Object.entries(selectedUsers)
      .filter(([_, isSelected]) => isSelected)
      .map(([email]) => groupMembers.find(member => member.email === email));

    if (selectedUsersList.length === 0) {
      Alert.alert(
        'Validation Error',
        'Please select at least one user to split with',
      );
      return;
    }

    // Additional validation for percentage split
    if (isSplitByPercentage) {
      const selectedPercentageUsers = selectedUsersList.filter(
        user => selectedPercentages[user.email],
      );

      // Validate percentage inputs
      const percentageTotal = selectedPercentageUsers.reduce((total, user) => {
        const percentage = parseFloat(selectedPercentages[user.email] || 0);
        return total + percentage;
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

    try {
      const splitData = {
        title,
        amount: parseFloat(amount),
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
        date: firestore.Timestamp.fromDate(date),
        createdAt: isEditMode
          ? split.createdAt
          : firestore.Timestamp.fromDate(new Date()),
      };

      const splitsCollection = firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits');

      if (isEditMode) {
        // Update existing split
        await splitsCollection.doc(split.id).update(splitData);
        Alert.alert('Success', 'Split updated successfully');
      } else {
        // Add new split
        await splitsCollection.add(splitData);
        Alert.alert('Success', 'Split added successfully');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving split:', error);
      Alert.alert(
        'Error',
        `Failed to ${
          isEditMode ? 'update' : 'create'
        } split. Please try again.`,
      );
    } finally {
      setLoading(false);
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

  const renderMemberCheckbox = member => {
    const currentUser = auth().currentUser;
    const isCurrentUser = member.email === currentUser?.email;
    const isSelected = selectedUsers[member.email];

    return (
      <Card key={member.email} style={styles.memberCard}>
        <TouchableOpacity
          style={styles.memberCheckboxContainer}
          onPress={() => !isCurrentUser && toggleUserSelection(member.email)}>
          <View style={styles.memberInfo}>
            <View style={styles.memberNameContainer}>
              <Text style={styles.memberName}>
                {member.name}
                {isCurrentUser && ' (You)'}
              </Text>
              {splitType === 'percentage' && (
                <TextInput
                  style={styles.percentageInput}
                  placeholder="% Split"
                  keyboardType="numeric"
                  value={selectedPercentages[member.email]}
                  onChangeText={text => {
                    setSelectedPercentages(prev => ({
                      ...prev,
                      [member.email]: text,
                    }));
                  }}
                />
              )}
            </View>
          </View>
          <Checkbox
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => toggleUserSelection(member.email)}
            color={PRIMARY_COLOR}
          />
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.screenTitle}>
        {isEditMode ? 'Edit Split' : 'Create Split'}
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Split Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter split title"
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter total amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setDatePickerVisible(true)}>
          <Text>{date.toLocaleDateString()}</Text>
          <MaterialCommunityIcons
            name="calendar"
            size={24}
            color={PRIMARY_COLOR}
          />
        </TouchableOpacity>
        <DatePickerModal
          locale="en"
          mode="single"
          visible={datePickerVisible}
          onDismiss={onDismissDatePicker}
          date={date}
          onConfirm={onConfirmDate}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category</Text>
        <DropDownPicker
          open={openCategory}
          value={category}
          items={CATEGORY_OPTIONS.map(cat => ({
            ...cat,
            icon: () => (
              <MaterialCommunityIcons
                name={cat.icon}
                size={24}
                color={PRIMARY_COLOR}
                style={styles.categoryIcon}
              />
            ),
          }))}
          setOpen={setOpenCategory}
          setValue={setCategory}
          placeholder="Select Category"
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          searchable={true}
          searchPlaceholder="Search categories..."
          listMode="MODAL"
          modalTitle="Select Split Category"
          modalAnimationType="slide"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Paid By</Text>
        <View style={styles.paidByContainer}>
          {groupMembers.map(member => (
            <TouchableOpacity
              key={member.email}
              style={[
                styles.paidByOption,
                paidBy?.email === member.email && styles.selectedPaidByOption,
              ]}
              onPress={() => setPaidBy(member)}>
              <Text
                style={[
                  styles.paidByText,
                  paidBy?.email === member.email && {color: 'white'},
                ]}>
                {member.name}
                {member.email === auth().currentUser?.email && ' (You)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Split Type</Text>
        {renderSplitTypeButtons()}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Split With</Text>
        {groupMembers.map(renderMemberCheckbox)}
      </View>

      <FormButton
        buttonTitle={isEditMode ? 'Update Split' : 'Create Split'}
        onPress={handleSubmit}
        disabled={loading}
        style={{width: width - 30, marginBottom: 20}}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3A3B3E',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  paidByContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paidByOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
  },
  selectedPaidByOption: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  paidByText: {
    color: '#3A3B3E',
  },
  memberCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  memberCheckboxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  memberName: {
    fontSize: 16,
    color: '#3A3B3E',
  },
  dropdown: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
    marginVertical: 10,
    borderRadius: 10,
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
  percentageInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 5,
    width: 70,
    padding: 5,
    marginLeft: 10,
    textAlign: 'center',
  },
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
  categoryIcon: {
    marginRight: 10,
  },
});

export default CreateSplitScreen;
