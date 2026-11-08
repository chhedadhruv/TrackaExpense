import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import {Card, Text, ActivityIndicator, Divider} from 'react-native-paper';
import {
  Timestamp,
  addDoc,
  collection,
  getFirestore,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import FormButton from '../components/FormButton';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../src/constants/theme';
import type {McIconName} from '../src/types/icons';

const SUCCESS_COLOR = '#25B07F';

interface ContactCategory {
  id: string;
  title: string;
  icon: McIconName;
  description: string;
}

const CONTACT_CATEGORIES: ContactCategory[] = [
  {
    id: 'feedback',
    title: 'General Feedback',
    icon: 'message-text',
    description: 'Share your thoughts or suggestions',
  },
  {
    id: 'bug',
    title: 'Report a Bug',
    icon: 'bug',
    description: 'Found something not working?',
  },
  {
    id: 'feature',
    title: 'Feature Request',
    icon: 'lightbulb',
    description: 'Suggest new features',
  },
  {
    id: 'support',
    title: 'Technical Support',
    icon: 'help-circle',
    description: 'Need help using the app?',
  },
];

const ContactUsScreen = ({navigation}: {navigation: any}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('feedback');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setUser(getAuth().currentUser);
  }, []);

  const handleSubmitMessage = async () => {
    setErrorMessage(null);
    if (!feedbackText.trim()) {
      setErrorMessage('Please provide your message before submitting');
      return;
    }
    if (feedbackText.trim().length < 10) {
      setErrorMessage(
        'Please provide more detailed information (at least 10 characters)',
      );
      return;
    }
    try {
      setLoading(true);
      await addDoc(collection(getFirestore(), 'contact_messages'), {
        userId: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        category: selectedCategory,
        messageText: feedbackText.trim(),
        createdAt: Timestamp.fromDate(new Date()),
        status: 'pending',
      });
      setFeedbackText('');
      Alert.alert(
        'Message Sent! 🎉',
        "Your message has been submitted successfully! We'll get back to you as soon as possible.",
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } catch (_) {
      setErrorMessage(
        'Failed to send message. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickContact = (type: string) => {
    if (type === 'email') {
      Linking.openURL(
        'mailto:me@dhruvchheda.com?subject=TrackaExpense Support',
      );
    } else if (type === 'privacy') {
      navigation.navigate('PrivacyPolicy');
    }
  };

  const getCategoryInfo = (categoryId: string): ContactCategory =>
    CONTACT_CATEGORIES.find(cat => cat.id === categoryId) ||
    CONTACT_CATEGORIES[0];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="account-voice"
              size={48}
              color={PRIMARY_COLOR}
            />
          </View>
          <Text style={styles.titleText}>Contact Us</Text>
          <Text style={styles.subtitleText}>
            We're here to help! Get in touch with our support team
          </Text>
        </View>

        <Card
          style={[
            styles.quickContactCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 2}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Quick Contact</Text>
            <TouchableOpacity
              style={styles.quickContactItem}
              onPress={() => handleQuickContact('email')}
              activeOpacity={0.7}>
              <View style={styles.quickContactLeft}>
                <View
                  style={[
                    styles.quickContactIcon,
                    {backgroundColor: '#E3F2FD'},
                  ]}>
                  <MaterialCommunityIcons
                    name="email"
                    size={24}
                    color="#2196F3"
                  />
                </View>
                <View>
                  <Text style={styles.quickContactTitle}>Email Support</Text>
                  <Text style={styles.quickContactSubtitle}>
                    me@dhruvchheda.com
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="open-in-new"
                size={20}
                color="#666"
              />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity
              style={styles.quickContactItem}
              onPress={() => handleQuickContact('privacy')}
              activeOpacity={0.7}>
              <View style={styles.quickContactLeft}>
                <View
                  style={[
                    styles.quickContactIcon,
                    {backgroundColor: '#E8F5E8'},
                  ]}>
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={24}
                    color="#4CAF50"
                  />
                </View>
                <View>
                  <Text style={styles.quickContactTitle}>Privacy Policy</Text>
                  <Text style={styles.quickContactSubtitle}>
                    Learn about data protection
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>
        </Card>

        <Card
          style={[
            styles.formCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 3}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Send us a Message</Text>
            {errorMessage && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#C62828"
                />
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              </View>
            )}
            <View style={styles.categorySection}>
              <Text style={styles.inputLabel}>What can we help you with?</Text>
              <View style={styles.categoryGrid}>
                {CONTACT_CATEGORIES.map(category => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryOption,
                      selectedCategory === category.id &&
                        styles.categoryOptionSelected,
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                    activeOpacity={0.7}>
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={24}
                      color={
                        selectedCategory === category.id
                          ? '#FFFFFF'
                          : PRIMARY_COLOR
                      }
                    />
                    <Text
                      style={[
                        styles.categoryTitle,
                        selectedCategory === category.id &&
                          styles.categoryTitleSelected,
                      ]}>
                      {category.title}
                    </Text>
                    <Text
                      style={[
                        styles.categoryDescription,
                        selectedCategory === category.id &&
                          styles.categoryDescriptionSelected,
                      ]}>
                      {category.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                {getCategoryInfo(selectedCategory).title} Details
              </Text>
              <TextInput
                value={feedbackText}
                onChangeText={text => {
                  setFeedbackText(text);
                  if (errorMessage) {
                    setErrorMessage(null);
                  }
                }}
                placeholder={`Please describe your ${getCategoryInfo(
                  selectedCategory,
                ).title.toLowerCase()} in detail...`}
                multiline
                numberOfLines={6}
                style={styles.textInput}
                placeholderTextColor="#999"
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={styles.characterCount}>
                {feedbackText.length}/1000 characters
              </Text>
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={styles.loadingText}>Sending your message...</Text>
              </View>
            ) : (
              <FormButton
                buttonTitle="Send Message"
                onPress={handleSubmitMessage}
              />
            )}
          </View>
        </Card>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color={SUCCESS_COLOR}
            />
            <Text style={styles.infoText}>
              Your messages are secure and confidential
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={20}
              color={PRIMARY_COLOR}
            />
            <Text style={styles.infoText}>
              We typically respond within 24-48 hours
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons
              name="account-group"
              size={20}
              color="#FF9800"
            />
            <Text style={styles.infoText}>
              Our support team is here to help you succeed
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default ContactUsScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  scrollContent: {padding: 20, paddingBottom: 40},
  headerSection: {alignItems: 'center', marginBottom: 25, paddingTop: 20},
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 20,
  },
  quickContactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
  },
  formCard: {backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 20},
  cardContent: {padding: 24},
  quickContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  quickContactLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  quickContactIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  quickContactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  quickContactSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginTop: 2,
  },
  divider: {backgroundColor: '#F0F0F0', marginVertical: 8},
  categorySection: {marginBottom: 25},
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryOption: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E8EBF7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 100,
  },
  categoryOptionSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
    textAlign: 'center',
    marginTop: 8,
  },
  categoryTitleSelected: {color: '#FFFFFF'},
  categoryDescription: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  categoryDescriptionSelected: {color: '#E8EBF7'},
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
  inputSection: {marginBottom: 25},
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
  loadingContainer: {alignItems: 'center', paddingVertical: 20},
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
    elevation: Platform.OS === 'android' ? 0 : 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  infoItem: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  infoText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
    marginLeft: 12,
    flex: 1,
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
