import React, {useState, useEffect} from 'react';
import {View, StyleSheet, ScrollView, Alert, TextInput} from 'react-native';
import {Card, Text} from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AntDesign from 'react-native-vector-icons/AntDesign';

import FormButton from '../components/FormButton';

const FeedbackScreen = ({navigation}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get the current authenticated user
    const currentUser = auth().currentUser;
    setUser(currentUser);
  }, []);

  const handleSubmitFeedback = async () => {
    // Validate feedback input
    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Please provide your feedback');
      return;
    }

    try {
      setLoading(true);

      // Submit feedback to Firestore
      await firestore()
        .collection('feedback')
        .add({
          userId: user.uid,
          name: user.displayName || user.email,
          email: user.email,
          feedbackText: feedbackText.trim(),
          createdAt: firestore.Timestamp.fromDate(new Date()),
          status: 'pending',
        });

      // Clear feedback and show success
      setFeedbackText('');

      Alert.alert(
        'Thank You',
        'Your feedback has been submitted successfully!',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (error) {
      console.error('Feedback submission error:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.loadingContainer}
      keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        {/* Header Card */}
        <Card style={styles.myCard}>
          <View style={styles.cardContentWithIcon}>
            <View style={styles.cardContent}>
              <Text style={styles.TitleText}>Submit Your Feedback</Text>
              <Text style={styles.BalanceText}>We Value Your Opinion</Text>
            </View>
            <View style={styles.Icon}>
              <AntDesign name="form" size={24} color="#fff" />
            </View>
          </View>
        </Card>

        {/* Feedback Form */}
        <View style={styles.formContainer}>
          <TextInput
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder="Share your feedback here..."
            multiline={true}
            numberOfLines={4}
            style={styles.textInput}
            placeholderTextColor="#666"
            textAlignVertical="top"
          />

          <FormButton
            buttonTitle={loading ? 'Submitting...' : 'Submit Feedback'}
            disabled={loading}
            onPress={handleSubmitFeedback}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    width: '100%',
    paddingHorizontal: 10,
  },
  formContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  textInput: {
    width: '95%',
    height: 120,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  myCard: {
    margin: 5,
    padding: 20,
    backgroundColor: '#677CD2',
  },
  cardContentWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  Icon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#7A8EE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  TitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CED6EC',
    marginBottom: 5,
  },
  BalanceText: {
    fontSize: 26,
    fontWeight: '500',
    color: '#fff',
  },
});

export default FeedbackScreen;
