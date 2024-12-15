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
} from 'react-native';
import {Text, ProgressBar, Provider} from 'react-native-paper';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AntDesign from 'react-native-vector-icons/AntDesign';
import DropDownPicker from 'react-native-dropdown-picker';

const {width} = Dimensions.get('window');
const PRIMARY_COLOR = '#677CD2';
const SECONDARY_COLOR = '#7A8EE0';
const BACKGROUND_COLOR = '#F4F6FA';

const SavingScreen = ({navigation}) => {
  const [amount, setAmount] = useState('');
  const [savingGoal, setSavingGoal] = useState('');
  const [category, setCategory] = useState(null);
  const [targetAmount, setTargetAmount] = useState('');
  const [savingsList, setSavingsList] = useState([]);
  const [error, setError] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch all savings from Firestore
  useEffect(() => {
    const currentUser = auth().currentUser;
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
  }, []);

  // Validate input
  const validateInputs = () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return false;
    }
    if (!savingGoal.trim()) {
      Alert.alert('Validation Error', 'Saving goal is required');
      return false;
    }
    if (!category) {
      Alert.alert('Validation Error', 'Please select a category');
      return false;
    }
    if (!targetAmount || isNaN(targetAmount) || parseFloat(targetAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid target amount');
      return false;
    }
    return true;
  };

  // Handle saving a new goal
  const handleSave = async () => {
    if (validateInputs()) {
      const currentUser = auth().currentUser;

      if (!currentUser) {
        Alert.alert('Error', 'No user is logged in');
        return;
      }

      try {
        const targetAmountParsed = parseFloat(targetAmount);
        const currentAmountParsed = parseFloat(amount);

        // Calculate progress as an integer percentage (rounded to nearest integer)
        const progress = Math.round(
          (currentAmountParsed / targetAmountParsed) * 100,
        );

        // Save saving goal and amount in Firestore
        const userSavingsRef = firestore()
          .collection('users')
          .doc(currentUser.uid)
          .collection('savings');

        await userSavingsRef.add({
          goal: savingGoal,
          category: category,
          targetAmount: targetAmountParsed,
          currentAmount: currentAmountParsed,
          progressPercentage: progress,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        Alert.alert('Success', 'Saving goal added successfully');
        resetForm();
      } catch (error) {
        setError('Error saving goal. Please try again.');
        console.error(error);
        Alert.alert('Error', 'Failed to save saving goal.');
      }
    }
  };

  // Reset form after saving
  const resetForm = () => {
    setAmount('');
    setSavingGoal('');
    setCategory(null);
    setTargetAmount('');
    setIsFormVisible(false);
  };

  // Category options for dropdown
  const CATEGORY_OPTIONS = [
    {
      label: 'Emergency Fund',
      value: 'Emergency',
      icon: () => <Text style={styles.categoryIcon}>🚨</Text>,
    },
    {
      label: 'Vacation',
      value: 'Vacation',
      icon: () => <Text style={styles.categoryIcon}>🏖️</Text>,
    },
    {
      label: 'Home Down Payment',
      value: 'HomePurchase',
      icon: () => <Text style={styles.categoryIcon}>🏠</Text>,
    },
    {
      label: 'Car',
      value: 'Car',
      icon: () => <Text style={styles.categoryIcon}>🚗</Text>,
    },
    {
      label: 'Technology',
      value: 'Tech',
      icon: () => <Text style={styles.categoryIcon}>💻</Text>,
    },
    {
      label: 'Education',
      value: 'Education',
      icon: () => <Text style={styles.categoryIcon}>📚</Text>,
    },
    {
      label: 'Personal Growth',
      value: 'PersonalGrowth',
      icon: () => <Text style={styles.categoryIcon}>🌱</Text>,
    },
    {
      label: 'Wedding',
      value: 'Wedding',
      icon: () => <Text style={styles.categoryIcon}>💍</Text>,
    },
  ];

  // Render individual saving item
  const renderSavingItem = ({item}) => {
    const progressColor =
      item.progressPercentage < 50 ? '#FF6B6B' : SECONDARY_COLOR;

    return (
      <View style={styles.savingCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.savingGoal} numberOfLines={1}>
            {item.goal}
          </Text>
          <Text style={styles.categoryBadge}>{item.category}</Text>
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
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() =>
            navigation.navigate('EditSaving', {savingId: item.id})
          }>
          <Text style={styles.viewButtonText}>Edit Goal</Text>
          <AntDesign name="edit" size={16} color="#fff" />
        </TouchableOpacity>
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
              />

              <FormButton
                buttonTitle="Save Goal"
                onPress={handleSave}
                style={[styles.saveButton, {width: width - 60}]}>
                <AntDesign name="save" size={20} color="#fff" />
              </FormButton>
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
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    marginTop: 15,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
});

export default SavingScreen;
