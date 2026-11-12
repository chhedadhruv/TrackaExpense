import React, {useState, useEffect} from 'react';
import {useRouter} from 'expo-router';
import {View, Text, TextInput, TouchableOpacity, Linking} from 'react-native';
import {ActivityIndicator} from 'react-native-paper';
import {
  Timestamp,
  addDoc,
  collection,
  getFirestore,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import Bug from 'lucide-react-native/icons/bug';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleHelp from 'lucide-react-native/icons/circle-help';
import Clock from 'lucide-react-native/icons/clock';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import Mail from 'lucide-react-native/icons/mail';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import Mic from 'lucide-react-native/icons/mic';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Users from 'lucide-react-native/icons/users';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import FormButton from '../components/FormButton';
import {useTheme} from '../src/theme';
import {FormError} from '../src/components/form/FormParts';
import type {AppIcon} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';

// Accent colours of the quick-contact icons. Each circle is the accent at a low alpha, so one
// accent reads on both the light and the dark card.
const ACCENT = {blue: '#2196F3', green: '#4CAF50'} as const;
const tint = (hex: string): string => `${hex}1F`;

interface ContactCategory {
  id: string;
  title: string;
  icon: AppIcon;
  description: string;
}

const CONTACT_CATEGORIES: ContactCategory[] = [
  {
    id: 'feedback',
    title: 'General Feedback',
    icon: MessageSquareText,
    description: 'Share your thoughts or suggestions',
  },
  {
    id: 'bug',
    title: 'Report a Bug',
    icon: Bug,
    description: 'Found something not working?',
  },
  {
    id: 'feature',
    title: 'Feature Request',
    icon: Lightbulb,
    description: 'Suggest new features',
  },
  {
    id: 'support',
    title: 'Technical Support',
    icon: CircleHelp,
    description: 'Need help using the app?',
  },
];

const ContactUsScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
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
      snackbar.success("Message sent. We'll get back to you soon.");
      router.back();
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
      router.navigate('/profile/privacy-policy');
    }
  };

  const getCategoryInfo = (categoryId: string): ContactCategory =>
    CONTACT_CATEGORIES.find(cat => cat.id === categoryId) ||
    CONTACT_CATEGORIES[0];

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="p-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="mb-[25px] items-center pt-5">
          <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
            <Mic size={48} color={colors.primary} />
          </View>
          <Text
            accessibilityRole="header"
            className="mb-2 text-center font-heading text-[28px] font-bold text-text-strong">
            Contact Us
          </Text>
          <Text className="px-2.5 text-center font-sans text-base leading-[22px] text-text-secondary">
            We're here to help! Get in touch with our support team
          </Text>
        </View>

        <View className="mb-5 rounded-2xl border border-card-border bg-surface ios:shadow-md">
          <View className="p-6">
            <Text className="mb-5 font-heading text-xl font-bold text-text-strong">
              Quick Contact
            </Text>
            <TouchableOpacity
              className="flex-row items-center justify-between py-4"
              accessibilityRole="link"
              accessibilityLabel="Email support"
              onPress={() => handleQuickContact('email')}
              activeOpacity={0.7}>
              <View className="flex-1 flex-row items-center">
                <View
                  className="mr-4 h-12 w-12 items-center justify-center rounded-xl"
                  style={{backgroundColor: tint(ACCENT.blue)}}>
                  <Mail size={24} color={ACCENT.blue} />
                </View>
                <View>
                  <Text className="font-sans-bold text-base font-semibold text-text-strong">
                    Email Support
                  </Text>
                  <Text className="mt-0.5 font-sans text-sm text-text-secondary">
                    me@dhruvchheda.com
                  </Text>
                </View>
              </View>
              <ExternalLink size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View className="my-2 h-px bg-divider" />
            <TouchableOpacity
              className="flex-row items-center justify-between py-4"
              accessibilityRole="button"
              onPress={() => handleQuickContact('privacy')}
              activeOpacity={0.7}>
              <View className="flex-1 flex-row items-center">
                <View
                  className="mr-4 h-12 w-12 items-center justify-center rounded-xl"
                  style={{backgroundColor: tint(ACCENT.green)}}>
                  <ShieldCheck size={24} color={ACCENT.green} />
                </View>
                <View>
                  <Text className="font-sans-bold text-base font-semibold text-text-strong">
                    Privacy Policy
                  </Text>
                  <Text className="mt-0.5 font-sans text-sm text-text-secondary">
                    Learn about data protection
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-5 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
          <View className="p-6">
            <Text className="mb-5 font-heading text-xl font-bold text-text-strong">
              Send us a Message
            </Text>
            {errorMessage && <FormError message={errorMessage} />}
            <View className="mb-[25px]">
              <Text className="mb-3 font-sans-bold text-base font-semibold text-text-strong">
                What can we help you with?
              </Text>
              <View className="flex-row flex-wrap justify-between gap-2.5">
                {CONTACT_CATEGORIES.map(category => {
                  const selected = selectedCategory === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      accessibilityRole="radio"
                      accessibilityState={{selected}}
                      className={`min-h-[100px] w-[48%] items-center rounded-xl border-2 p-4 ${
                        selected
                          ? 'border-primary-fill bg-primary-fill'
                          : 'border-card-border bg-surface-muted'
                      }`}
                      onPress={() => setSelectedCategory(category.id)}
                      activeOpacity={0.7}>
                      <category.icon
                        size={24}
                        color={selected ? colors.onPrimary : colors.primary}
                      />
                      <Text
                        className={`mt-2 text-center font-sans-bold text-sm font-semibold ${
                          selected ? 'text-on-primary' : 'text-text-strong'
                        }`}>
                        {category.title}
                      </Text>
                      <Text
                        className={`mt-1 text-center font-sans text-xs ${
                          selected
                            ? 'text-on-primary opacity-85'
                            : 'text-text-secondary'
                        }`}>
                        {category.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View className="mb-[25px]">
              <Text className="mb-3 font-sans-bold text-base font-semibold text-text-strong">
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
                className="min-h-[140px] rounded-2xl border-2 border-border bg-surface-muted p-4 font-sans text-base text-text-strong"
                placeholderTextColor={colors.textPlaceholder}
                selectionColor={colors.primary}
                textAlignVertical="top"
                maxLength={1000}
                accessibilityLabel={`${
                  getCategoryInfo(selectedCategory).title
                } details`}
              />
              <Text className="mt-2 text-right font-sans text-xs text-text-placeholder">
                {feedbackText.length}/1000 characters
              </Text>
            </View>
            {loading ? (
              <View className="items-center py-5">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="mt-3 font-sans text-base text-text-secondary">
                  Sending your message...
                </Text>
              </View>
            ) : (
              <FormButton
                buttonTitle="Send Message"
                onPress={handleSubmitMessage}
              />
            )}
          </View>
        </View>

        <View className="rounded-2xl border border-card-border bg-surface p-5 ios:shadow-md">
          <View className="mb-3 flex-row items-center">
            <ShieldCheck size={20} color={colors.success} />
            <Text className="ml-3 flex-1 font-sans text-sm text-text-secondary">
              Your messages are secure and confidential
            </Text>
          </View>
          <View className="mb-3 flex-row items-center">
            <Clock size={20} color={colors.primary} />
            <Text className="ml-3 flex-1 font-sans text-sm text-text-secondary">
              We typically respond within 24-48 hours
            </Text>
          </View>
          <View className="flex-row items-center">
            <Users size={20} color={colors.warning} />
            <Text className="ml-3 flex-1 font-sans text-sm text-text-secondary">
              Our support team is here to help you succeed
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default ContactUsScreen;
