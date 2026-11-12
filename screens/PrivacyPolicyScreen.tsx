import React, {useState} from 'react';
import {useRouter} from 'expo-router';
import {View, Text, ScrollView, TouchableOpacity, Linking} from 'react-native';
import Baby from 'lucide-react-native/icons/baby';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Database from 'lucide-react-native/icons/database';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Link from 'lucide-react-native/icons/link';
import Mail from 'lucide-react-native/icons/mail';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Settings from 'lucide-react-native/icons/settings';
import Shield from 'lucide-react-native/icons/shield';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import UserCheck from 'lucide-react-native/icons/user-check';
import {version as appVersion} from '../package.json';
import {useTheme} from '../src/theme';
import type {AppIcon} from '../src/types/icons';

// Change this date whenever the policy text changes (it used to show today's date every time).
const LAST_UPDATED = '10 November 2026';

interface PolicySection {
  id: string;
  title: string;
  icon: AppIcon;
  content: string;
}

const PRIVACY_SECTIONS: PolicySection[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: ShieldCheck,
    content: `TrackaExpense is committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use our expense tracking application.\nLast updated: ${LAST_UPDATED}\nYour Privacy Rights:\n• You have complete control over your data\n• Account deletion is available instantly through the app\n• All data can be permanently removed at any time\n• We never sell your personal information\nBy using TrackaExpense, you agree to the collection and use of information in accordance with this policy.`,
  },
  {
    id: 'data_collection',
    title: 'Information We Collect',
    icon: Database,
    content: `We collect the following types of information:\nPersonal Information:\n• Name and email address (required for account creation)\n• Phone number (optional, so friends can find you when adding you to a group)\n• Profile pictures (optional, stored securely)\n• Google account information (when using Google Sign-In)\n• Apple ID information (when using Apple Sign-In)\nFinancial Data:\n• Income and expense records (titles, descriptions, amounts, categories, dates)\n• Receipt images and attachments\n• Account balance information\n• Transaction history and spending patterns\nGroup & Social Data:\n• Group memberships for expense splitting\n• Shared expense details and payment records\n• Split calculations and settlement information\nWhat Other People Can See:\n• Your name, profile picture and email address are visible to members of the groups you join\n• People who know your email address or phone number can find your account to add you to a group; only your name and profile picture are shown to them\nUsage and Diagnostics:\n• Which features you use (for example adding an expense or settling up), with coarse amount ranges and never exact amounts, titles, notes, names or email addresses\n• Crash and error reports from your device (app version, device model, operating system version)\nDevice and Notification Data:\n• A push notification token and your user ID, so we can send you the notifications you allow`,
  },
  {
    id: 'data_usage',
    title: 'How We Use Your Information',
    icon: Settings,
    content: `We use your information to:\nCore Functionality:\n• Provide expense tracking and financial management services\n• Process and store your income and expense transactions\n• Calculate spending statistics and financial insights\n• Enable expense splitting with friends and groups\nAccount Management:\n• Create and maintain your user account\n• Authenticate your identity through email/password, Google Sign-In, or Apple Sign-In\n• Send important account-related notifications\n• Provide customer support when needed\nNotifications and Improvement:\n• Send push notifications about your groups, splits, settlements and reminders\n• Understand which features are used, and find and fix crashes\nWe do NOT use your financial data for advertising or sell your information to third parties.`,
  },
  {
    id: 'data_storage',
    title: 'Data Storage & Security',
    icon: Shield,
    content: `Cloud Storage:\nYour data is securely stored using Google Firebase services:\n• Authentication data is handled by Firebase Auth\n• Financial records are stored in Firebase Firestore\n• Receipt images are stored in Firebase Storage\n• Data is encrypted in transit (HTTPS/TLS) and encrypted at rest by Google\nSecurity Measures:\n• Encrypted connections for all data sent between the app and our services\n• Secure authentication using Firebase Auth, Google Sign-In, and Apple Sign-In\n• Regular security updates and monitoring\nData Retention:\n• Your data is retained while your account is active\n• You can delete your account instantly through the app's "Account Actions" feature\n• Complete data removal includes all transactions, receipts, and associated files\n• Analytics, crash and notification records are handled as described under Your Rights & Choices`,
  },
  {
    id: 'third_party',
    title: 'Third-Party Services',
    icon: Link,
    content: `TrackaExpense uses the following third-party services:\nGoogle Firebase:\n• Firebase Authentication for secure login/signup\n• Firebase Firestore for data storage\n• Firebase Storage for receipt images\n• Cloud Functions for server-side processing of settlements, invitations and notifications\n• Cloud Messaging, Analytics, Crashlytics, Performance Monitoring and Remote Config for notification delivery, diagnostics and app settings\n• Subject to Google's Privacy Policy\nGoogle Sign-In:\n• Google OAuth 2.0 for secure authentication\n• Subject to Google's Terms of Service and Privacy Policy\nApple Sign-In:\n• Apple OAuth 2.0 for secure authentication\n• Subject to Apple's Terms of Service and Privacy Policy\nSentry (error reporting):\n• Receives crash and error reports with your user ID only, never your email address, name or IP address\n• Subject to Sentry's Privacy Policy\nMixpanel (usage analytics):\n• Receives feature-usage events linked to your user ID, with IP-based location turned off\n• Subject to Mixpanel's Privacy Policy\nOneSignal (push notifications):\n• Receives your push token, user ID, platform, app version and currency setting in order to deliver notifications\n• Subject to OneSignal's Privacy Policy\nNo Data Selling:\nWe do not sell, trade, or rent your personal information to third parties.`,
  },
  {
    id: 'user_rights',
    title: 'Your Rights & Choices',
    icon: UserCheck,
    content: `You have the following rights regarding your personal data:\nAccess & Control:\n• View and edit your profile information\n• Modify or delete individual transactions\n• Manage Google Sign-In and Apple Sign-In account linking\nDeletion Rights:\n• Delete individual transactions or receipts\n• Close your account and delete all associated data\n• Use the in-app account deletion feature for immediate removal\nAccount Deletion Process:\n• Access "Account Actions" in your profile settings\n• Complete the secure deletion process with confirmations\n• All data is permanently removed including transactions, receipts, and group memberships\n• Account deletion cannot be reversed once completed\nAnalytics, Crash and Notification Records:\n• These records contain no names, email addresses or exact amounts and are linked only to your user ID\n• Contact us through the app and we will delete them on request`,
  },
  {
    id: 'children',
    title: "Children's Privacy",
    icon: Baby,
    content: `TrackaExpense is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13.\nIf you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately so we can delete such information.`,
  },
  {
    id: 'changes',
    title: 'Privacy Policy Updates',
    icon: RefreshCw,
    content: `We may update this Privacy Policy from time to time to reflect:\n• Changes in our data practices\n• New features or services\n• Legal or regulatory requirements\n• Security improvements\nNotification:\n• We will notify you of significant changes through the app\n• Updated policies will be posted with a new "last updated" date\n• Continued use of the app constitutes acceptance of changes`,
  },
  {
    id: 'contact',
    title: 'Contact Information',
    icon: Mail,
    content: `If you have questions about this Privacy Policy or your data:\nContact Us Feature:\nUse the built-in contact feature in the app's Profile section to reach our support team directly.\nResponse Time:\nWe aim to respond to all privacy-related inquiries within 48 hours.`,
  },
];

const ExpandableSection = ({
  section,
  expanded,
  onToggle,
}: {
  section: PolicySection;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const {colors} = useTheme();
  return (
    <View className="mb-3 rounded-xl border border-card-border bg-surface ios:shadow-md">
      <TouchableOpacity
        className="flex-row items-center justify-between p-4"
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{expanded}}
        activeOpacity={0.7}>
        <View className="flex-1 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft">
            <section.icon size={24} color={colors.primary} />
          </View>
          <Text className="flex-1 font-sans-bold text-base font-semibold text-text-strong">
            {section.title}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={24} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={24} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View className="pb-4">
          <View className="mx-4 mb-4 h-px bg-divider" />
          <Text className="px-4 font-sans text-sm leading-5 text-text-strong">
            {section.content}
          </Text>
        </View>
      )}
    </View>
  );
};

interface PrivacyPolicyScreenProps {
  /**
   * Contact Us only exists after sign-in; before it (from Sign up) the button would go nowhere,
   * so only the signed-in route turns this on.
   */
  canContactSupport?: boolean;
}

const PrivacyPolicyScreen = ({
  canContactSupport = false,
}: PrivacyPolicyScreenProps) => {
  const {colors} = useTheme();
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (id: string) =>
    setExpandedSections(prev => ({...prev, [id]: !prev[id]}));

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-[30px]">
        <View className="items-center px-5 pb-[25px] pt-5">
          <View className="mb-[15px]">
            <ShieldCheck size={48} color={colors.primary} />
          </View>
          <Text
            accessibilityRole="header"
            className="mb-2 font-heading text-[28px] font-bold text-text-strong">
            Privacy Policy
          </Text>
          <Text className="text-center font-sans text-base leading-[22px] text-text-secondary">
            Your privacy matters to us. Learn how we collect, use, and protect
            your data.
          </Text>
        </View>

        <View className="mx-5 mb-5 rounded-2xl bg-primary-fill ios:shadow-lg">
          <View className="p-5">
            <Text className="mb-2.5 font-heading text-lg font-bold text-on-primary">
              Quick Summary
            </Text>
            <Text className="font-sans text-sm leading-5 text-on-primary opacity-90">
              TrackaExpense collects only the data necessary to provide expense
              tracking services. We use secure Firebase infrastructure with
              Google Sign-In support, don't sell your data, and give you full
              control over your information. Tap any section below for detailed
              information.
            </Text>
          </View>
        </View>

        <View className="px-5">
          {PRIVACY_SECTIONS.map(section => (
            <ExpandableSection
              key={section.id}
              section={section}
              expanded={!!expandedSections[section.id]}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </View>

        <View className="gap-3 px-5 pt-5">
          {canContactSupport && (
            <TouchableOpacity
              className="flex-row items-center justify-center rounded-xl bg-primary-fill py-[15px] ios:shadow-md"
              accessibilityRole="button"
              onPress={() => router.navigate('/profile/contact')}>
              <MessageSquareText size={20} color={colors.onPrimary} />
              <Text className="ml-2 font-sans-bold text-base font-semibold text-on-primary">
                Contact Support
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="flex-row items-center justify-center rounded-xl border border-primary bg-surface py-[15px]"
            accessibilityRole="link"
            onPress={() =>
              Linking.openURL(
                'https://firebase.google.com/support/privacy',
              ).catch(() => {})
            }>
            <ExternalLink size={20} color={colors.primary} />
            <Text className="ml-2 font-sans-bold text-base font-semibold text-primary">
              Firebase Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        <View className="items-center px-5 pt-[30px]">
          <Text className="mb-1 font-sans text-xs text-text-secondary">
            Last updated: {LAST_UPDATED}
          </Text>
          <Text className="mb-1 font-sans text-xs text-text-secondary">
            TrackaExpense v{appVersion}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;
