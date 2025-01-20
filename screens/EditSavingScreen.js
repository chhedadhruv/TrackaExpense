import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import {Text, Provider} from 'react-native-paper';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Feather from 'react-native-vector-icons/Feather';
import DropDownPicker from 'react-native-dropdown-picker';

const {width} = Dimensions.get('window');
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

// Category options for dropdown - matching the main screen categories
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

const EditSavingScreen = ({route, navigation}) => {
  const {savingId, isCollaborative} = route.params;

  const [savingGoal, setSavingGoal] = useState('');
  const [category, setCategory] = useState(null);
  const [targetAmount, setTargetAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch saving data to edit
  useEffect(() => {
    const currentUser = auth().currentUser;

    if (currentUser && savingId) {
      const unsubscribe = firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('savings')
        .doc(savingId)
        .onSnapshot(
          documentSnapshot => {
            if (documentSnapshot.exists) {
              const savingData = documentSnapshot.data();
              setSavingGoal(savingData.goal);
              setCategory(savingData.category);
              setTargetAmount(savingData.targetAmount.toString());
              setAmount(savingData.currentAmount.toString());
            }
          },
          error => {
            setError('Error fetching saving data');
            console.error(error);
          },
        );

      return () => unsubscribe();
    }
  }, [savingId]);

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

  // Handle saving an updated goal
  const handleUpdate = async () => {
    if (validateInputs()) {
      setLoading(true);
      const currentUser = auth().currentUser;

      if (!currentUser) {
        Alert.alert('Error', 'No user is logged in');
        setLoading(false);
        return;
      }

      try {
        const targetAmountParsed = parseFloat(targetAmount);
        const currentAmountParsed = parseFloat(amount);
        const progress = Math.round(
          (currentAmountParsed / targetAmountParsed) * 100,
        );

        const updateData = {
          goal: savingGoal,
          category: category,
          targetAmount: targetAmountParsed,
          currentAmount: currentAmountParsed,
          progressPercentage: progress,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        };

        if (isCollaborative) {
          // Get the group ID from the current saving
          const savingDoc = await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('savings')
            .doc(savingId)
            .get();

          const groupId = savingDoc.data().groupId;

          if (groupId) {
            // Update the group document
            await firestore()
              .collection('savingGroups')
              .doc(groupId)
              .update({
                totalSaved: currentAmountParsed,
                targetAmount: targetAmountParsed,
                goal: savingGoal,
              });

            // Update savings for all group members
            const groupDoc = await firestore()
              .collection('savingGroups')
              .doc(groupId)
              .get();
            
            const groupData = groupDoc.data();
            const batch = firestore().batch();

            for (const memberEmail of groupData.members) {
              const userSnapshot = await firestore()
                .collection('users')
                .where('email', '==', memberEmail)
                .get();

              if (!userSnapshot.empty) {
                const userId = userSnapshot.docs[0].id;
                const memberSavingsQuery = await firestore()
                  .collection('users')
                  .doc(userId)
                  .collection('savings')
                  .where('groupId', '==', groupId)
                  .get();

                memberSavingsQuery.docs.forEach((doc) => {
                  batch.update(doc.ref, updateData);
                });
              }
            }

            await batch.commit();
          }
        } else {
          // Update individual saving
          await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('savings')
            .doc(savingId)
            .update(updateData);
        }

        Alert.alert('Success', 'Saving goal updated successfully');
        navigation.goBack();
      } catch (error) {
        console.error('Error updating goal:', error);
        setError('Error updating goal. Please try again.');
        Alert.alert('Error', 'Failed to update saving goal.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Provider>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.header}>
              Edit {isCollaborative ? 'Group' : ''} Saving Goal
            </Text>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

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
              zIndex={1000}
            />

            <FormButton
              buttonTitle="Update Goal"
              onPress={handleUpdate}
              style={[styles.saveButton, {width: width - 60}]}
              loading={loading}>
              <AntDesign name="save" size={20} color="#fff" />
            </FormButton>
          </View>
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
    marginBottom: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 15,
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
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default EditSavingScreen;