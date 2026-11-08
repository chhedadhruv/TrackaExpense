import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Platform,
} from 'react-native';
import {Card, Divider} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {PRIMARY_COLOR, BACKGROUND_COLOR} from '../src/constants/theme';
import type {McIconName} from '../src/types/icons';

const TEXT_COLOR = '#2C2C2C';
const SUBTITLE_COLOR = '#666';

interface PolicySection {
  id: string;
  title: string;
  icon: McIconName;
  content: string;
}

const PRIVACY_SECTIONS: PolicySection[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: 'shield-check',
    content: `TrackaExpense is committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use our expense tracking application.\nLast updated: ${new Date().toLocaleDateString()}\nYour Privacy Rights:\n• You have complete control over your data\n• Account deletion is available instantly through the app\n• All data can be permanently removed at any time\n• We never sell your personal information\nBy using TrackaExpense, you agree to the collection and use of information in accordance with this policy.`,
  },
  {
    id: 'data_collection',
    title: 'Information We Collect',
    icon: 'database',
    content: `We collect the following types of information:\nPersonal Information:\n• Name and email address (required for account creation)\n• Phone number (optional, for account verification)\n• Profile pictures (optional, stored securely)\n• Google account information (when using Google Sign-In)\n• Apple ID information (when using Apple Sign-In)\nFinancial Data:\n• Income and expense records (titles, descriptions, amounts, categories, dates)\n• Receipt images and attachments\n• Account balance information\n• Transaction history and spending patterns\nGroup & Social Data:\n• Group memberships for expense splitting\n• Shared expense details and payment records\n• Split calculations and settlement information`,
  },
  {
    id: 'data_usage',
    title: 'How We Use Your Information',
    icon: 'cog',
    content: `We use your information to:\nCore Functionality:\n• Provide expense tracking and financial management services\n• Process and store your income and expense transactions\n• Calculate spending statistics and financial insights\n• Enable expense splitting with friends and groups\nAccount Management:\n• Create and maintain your user account\n• Authenticate your identity through email/password, Google Sign-In, or Apple Sign-In\n• Send important account-related notifications\n• Provide customer support when needed\nWe do NOT use your financial data for advertising or sell your information to third parties.`,
  },
  {
    id: 'data_storage',
    title: 'Data Storage & Security',
    icon: 'shield-lock',
    content: `Cloud Storage:\nYour data is securely stored using Google Firebase services:\n• Authentication data is handled by Firebase Auth\n• Financial records are stored in Firebase Firestore\n• Receipt images are stored in Firebase Storage\n• All data transmission is encrypted using industry-standard protocols\nSecurity Measures:\n• End-to-end encryption for data transmission\n• Secure authentication using Firebase Auth, Google Sign-In, and Apple Sign-In\n• Regular security updates and monitoring\nData Retention:\n• Your data is retained while your account is active\n• You can delete your account instantly through the app's "Account Actions" feature\n• Complete data removal includes all transactions, receipts, and associated files`,
  },
  {
    id: 'third_party',
    title: 'Third-Party Services',
    icon: 'link-variant',
    content: `TrackaExpense uses the following third-party services:\nGoogle Firebase:\n• Firebase Authentication for secure login/signup\n• Firebase Firestore for data storage\n• Firebase Storage for receipt images\n• Subject to Google's Privacy Policy\nGoogle Sign-In:\n• Google OAuth 2.0 for secure authentication\n• Subject to Google's Terms of Service and Privacy Policy\nApple Sign-In:\n• Apple OAuth 2.0 for secure authentication\n• Subject to Apple's Terms of Service and Privacy Policy\nNo Data Selling:\nWe do not sell, trade, or rent your personal information to third parties.`,
  },
  {
    id: 'user_rights',
    title: 'Your Rights & Choices',
    icon: 'account-check',
    content: `You have the following rights regarding your personal data:\nAccess & Control:\n• View and edit your profile information\n• Modify or delete individual transactions\n• Manage Google Sign-In and Apple Sign-In account linking\nDeletion Rights:\n• Delete individual transactions or receipts\n• Close your account and delete all associated data\n• Use the in-app account deletion feature for immediate removal\nAccount Deletion Process:\n• Access "Account Actions" in your profile settings\n• Complete the secure deletion process with confirmations\n• All data is permanently removed including transactions, receipts, and group memberships\n• Account deletion cannot be reversed once completed`,
  },
  {
    id: 'children',
    title: "Children's Privacy",
    icon: 'baby-face',
    content: `TrackaExpense is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13.\nIf you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately so we can delete such information.`,
  },
  {
    id: 'changes',
    title: 'Privacy Policy Updates',
    icon: 'update',
    content: `We may update this Privacy Policy from time to time to reflect:\n• Changes in our data practices\n• New features or services\n• Legal or regulatory requirements\n• Security improvements\nNotification:\n• We will notify you of significant changes through the app\n• Updated policies will be posted with a new "last updated" date\n• Continued use of the app constitutes acceptance of changes`,
  },
  {
    id: 'contact',
    title: 'Contact Information',
    icon: 'email',
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
}) => (
  <Card
    style={[
      styles.sectionCard,
      Platform.OS === 'android' && styles.cardAndroid,
    ]}
    elevation={Platform.OS === 'android' ? 0 : 2}>
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={onToggle}
      activeOpacity={0.7}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={section.icon}
            size={24}
            color={PRIMARY_COLOR}
          />
        </View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
      <MaterialCommunityIcons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={24}
        color={SUBTITLE_COLOR}
      />
    </TouchableOpacity>
    {expanded && (
      <View style={styles.sectionContent}>
        <Divider style={styles.divider} />
        <Text style={styles.contentText}>{section.content}</Text>
      </View>
    )}
  </Card>
);

const PrivacyPolicyScreen = ({navigation}: {navigation: any}) => {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (id: string) =>
    setExpandedSections(prev => ({...prev, [id]: !prev[id]}));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons
              name="shield-check"
              size={48}
              color={PRIMARY_COLOR}
            />
          </View>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>
            Your privacy matters to us. Learn how we collect, use, and protect
            your data.
          </Text>
        </View>

        <Card
          style={[
            styles.summaryCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 3}>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Quick Summary</Text>
            <Text style={styles.summaryText}>
              TrackaExpense collects only the data necessary to provide expense
              tracking services. We use secure Firebase infrastructure with
              Google Sign-In support, don't sell your data, and give you full
              control over your information. Tap any section below for detailed
              information.
            </Text>
          </View>
        </Card>

        <View style={styles.sectionsContainer}>
          {PRIVACY_SECTIONS.map(section => (
            <ExpandableSection
              key={section.id}
              section={section}
              expanded={!!expandedSections[section.id]}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('ContactUs')}>
            <MaterialCommunityIcons
              name="message-text"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.primaryButtonText}>Contact Support</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              Linking.openURL(
                'https://firebase.google.com/support/privacy',
              ).catch(() => {})
            }>
            <MaterialCommunityIcons
              name="open-in-new"
              size={20}
              color={PRIMARY_COLOR}
            />
            <Text style={styles.secondaryButtonText}>
              Firebase Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {new Date().toLocaleDateString()}
          </Text>
          <Text style={styles.footerText}>TrackaExpense v1.2.8</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PrivacyPolicyScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  scrollContent: {paddingBottom: 30},
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 25,
  },
  headerIcon: {marginBottom: 15},
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: SUBTITLE_COLOR,
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  summaryContent: {padding: 20},
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    color: '#E8EBF7',
    fontFamily: 'Lato-Regular',
    lineHeight: 20,
  },
  sectionsContainer: {paddingHorizontal: 20},
  sectionCard: {backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    fontFamily: 'Lato-Bold',
    flex: 1,
  },
  sectionContent: {paddingBottom: 16},
  divider: {marginHorizontal: 16, marginBottom: 16, backgroundColor: '#F0F0F0'},
  contentText: {
    fontSize: 14,
    color: TEXT_COLOR,
    fontFamily: 'Lato-Regular',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actionButtons: {paddingHorizontal: 20, paddingTop: 20, gap: 12},
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 3,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  footer: {alignItems: 'center', paddingTop: 30, paddingHorizontal: 20},
  footerText: {
    fontSize: 12,
    color: SUBTITLE_COLOR,
    fontFamily: 'Lato-Regular',
    marginBottom: 4,
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
