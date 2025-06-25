import React, {useState, useEffect} from 'react';
import {View, StyleSheet, ScrollView, Alert, TextInput, SafeAreaView} from 'react-native';
import {Card, Text, ActivityIndicator} from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

import FormButton from '../components/FormButton';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

const FeedbackScreen = ({navigation}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    // Get the current authenticated user
    const currentUser = auth().currentUser;
    setUser(currentUser);
  }, []);

  const handleSubmitFeedback = async () => {
    setErrorMessage(null);
    
    // Validate feedback input
    if (!feedbackText.trim()) {
      setErrorMessage('Please provide your feedback before submitting');
      return;
    }

    if (feedbackText.trim().length < 10) {
      setErrorMessage('Please provide more detailed feedback (at least 10 characters)');
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
        'Thank You! 🎉',
        'Your feedback has been submitted successfully! We appreciate your input and will review it soon.',
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (error) {
      console.error('Feedback submission error:', error);
      setErrorMessage('Failed to submit feedback. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="message-text-outline" size={48} color={PRIMARY_COLOR} />
          </View>
          <Text style={styles.titleText}>Share Your Feedback</Text>
          <Text style={styles.subtitleText}>Help us improve TrackaExpense with your valuable insights</Text>
        </View>

        {/* Feedback Form Card */}
        <Card style={styles.formCard}>
          <View style={styles.cardContent}>
            {errorMessage && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#C62828" />
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Your Feedback</Text>
              <TextInput
                value={feedbackText}
                onChangeText={(text) => {
                  setFeedbackText(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Tell us what you think about the app, suggest new features, report issues, or share any other feedback..."
                multiline={true}
                numberOfLines={6}
                style={styles.textInput}
                placeholderTextColor="#999"
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {feedbackText.length}/500 characters
              </Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={styles.loadingText}>Submitting your feedback...</Text>
              </View>
            ) : (
              <FormButton
                buttonTitle="Submit Feedback"
                onPress={handleSubmitFeedback}
              />
            )}
          </View>
        </Card>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="shield-check" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.infoText}>Your feedback is anonymous and secure</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.infoText}>We typically respond within 24-48 hours</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  formCard: {
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
    marginBottom: 20,
  },
  cardContent: {
    padding: 30,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorMessage: {
    color: '#C62828',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    marginLeft: 8,
    flex: 1,
  },
  inputSection: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Lato-Regular',
    backgroundColor: '#FAFAFA',
    minHeight: 140,
    color: '#2C2C2C',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Lato-Regular',
    textAlign: 'right',
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginTop: 12,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginLeft: 12,
    flex: 1,
  },
});

export default FeedbackScreen;
