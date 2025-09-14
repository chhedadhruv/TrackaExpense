import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
} from 'react-native';
import {Card, Divider} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const TEXT_COLOR = '#2C2C2C';
const SUBTITLE_COLOR = '#666';
const PrivacyPolicyScreen = ({navigation}) => {
  const [expandedSections, setExpandedSections] = useState({});
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  const privacyPolicySections = [
    {
      id: 'overview',
      title: 'Overview',
      icon: 'shield-check',
      content: `TrackaExpense is committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use our expense tracking application.
Last updated: ${new Date().toLocaleDateString()}
Your Privacy Rights:
• You have complete control over your data
• Account deletion is available instantly through the app
• All data can be permanently removed at any time
• We never sell your personal information
By using TrackaExpense, you agree to the collection and use of information in accordance with this policy.`
    },
    {
      id: 'data_collection',
      title: 'Information We Collect',
      icon: 'database',
      content: `We collect the following types of information:
Personal Information:
• Name and email address (required for account creation)
• Phone number (for account verification)
• Profile pictures (optional, stored securely)
Financial Data:
• Income and expense records (titles, descriptions, amounts, categories, dates)
• Receipt images and attachments
• Account balance information
• Transaction history and spending patterns
Group & Social Data:
• Group memberships for expense splitting
• Shared expense details and payment records
• Split calculations and settlement information
Technical Information:
• Device information and operating system
• App usage patterns and navigation data
• Authentication tokens and session data
• Local app preferences and settings
Device Permissions:
• Camera access (for receipt photos)
• Photo library access (for receipt images)
• Contact access (for group expense features, if enabled)`
    },
    {
      id: 'data_usage',
      title: 'How We Use Your Information',
      icon: 'cog',
      content: `We use your information to:
Core Functionality:
• Provide expense tracking and financial management services
• Process and store your income and expense transactions
• Calculate spending statistics and financial insights
• Enable expense splitting with friends and groups
Account Management:
• Create and maintain your user account
• Authenticate your identity and secure your account
• Send important account-related notifications
• Provide customer support when needed
App Improvement:
• Analyze usage patterns to improve app functionality
• Identify and fix technical issues
• Develop new features based on user needs
Communication:
• Send account verification emails
• Provide password reset functionality
• Respond to feedback and support requests
We do NOT use your financial data for advertising or sell your information to third parties.`
    },
    {
      id: 'data_storage',
      title: 'Data Storage & Security',
      icon: 'shield-lock',
      content: `Cloud Storage:
Your data is securely stored using Google Firebase services:
• Authentication data is handled by Firebase Auth
• Financial records are stored in Firebase Firestore
• Receipt images are stored in Firebase Storage
• All data transmission is encrypted using industry-standard protocols
Local Storage:
Some data is stored locally on your device:
• App preferences and settings
• Temporary session information
• Onboarding status
Security Measures:
• End-to-end encryption for data transmission
• Secure authentication using Firebase Auth
• Regular security updates and monitoring
• Access controls and user permission systems
• Secure file storage with user-specific access
Data Retention:
• Your data is retained while your account is active
• You can delete your account instantly through the app's "Account Actions" feature
• Complete data removal includes all transactions, receipts, and associated files
• Inactive accounts may be deleted after extended periods
• Individual data elements can be deleted selectively upon request`
    },
    {
      id: 'third_party',
      title: 'Third-Party Services',
      icon: 'link-variant',
      content: `TrackaExpense uses the following third-party services:
Google Firebase:
• Firebase Authentication for secure login/signup
• Firebase Firestore for data storage
• Firebase Storage for receipt images
• Subject to Google's Privacy Policy
Device Services:
• Camera and photo library (with your permission)
• Contact access (optional, for group features)
• Local storage for app preferences
No Data Selling:
We do not sell, trade, or rent your personal information to third parties. Any third-party integrations are solely for app functionality and are governed by their respective privacy policies.
Analytics:
We may use anonymized analytics to understand app usage patterns, but this data cannot be linked back to individual users.`
    },
    {
      id: 'user_rights',
      title: 'Your Rights & Choices',
      icon: 'account-check',
      content: `You have the following rights regarding your personal data:
Access & Control:
• View and edit your profile information
• Download your transaction data
• Modify or delete individual transactions
• Update privacy preferences
Data Portability:
• Export your financial data in standard formats
• Transfer your data to other services
• Request a complete copy of your data
Deletion Rights:
• Delete individual transactions or receipts
• Close your account and delete all associated data
• Use the in-app account deletion feature for immediate removal
• Request immediate data removal through customer support
Account Deletion Process:
• Access "Account Actions" in your profile settings
• Complete the secure deletion process with confirmations
• All data is permanently removed including transactions, receipts, and group memberships
• Account deletion cannot be reversed once completed
Consent Management:
• Withdraw consent for data processing at any time
• Opt out of non-essential data collection
• Control what information is shared in group features
Communication:
• Unsubscribe from promotional emails
• Control notification preferences
• Limit communication types
To exercise any of these rights, please contact us through the app's contact feature or email support.`
    },
    {
      id: 'children',
      title: 'Children\'s Privacy',
      icon: 'baby-face',
      content: `TrackaExpense is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13.
If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately so we can delete such information.
For users between 13-18, parental consent may be required depending on your jurisdiction's laws.`
    },
    {
      id: 'changes',
      title: 'Privacy Policy Updates',
      icon: 'update',
      content: `We may update this Privacy Policy from time to time to reflect:
• Changes in our data practices
• New features or services
• Legal or regulatory requirements
• Security improvements
Notification:
• We will notify you of significant changes through the app
• Updated policies will be posted with a new "last updated" date
• Continued use of the app constitutes acceptance of changes
Version History:
You can always view the current version of our Privacy Policy within the app. Previous versions may be requested through customer support.`
    },
    {
      id: 'contact',
      title: 'Contact Information',
      icon: 'email',
      content: `If you have questions about this Privacy Policy or your data:
Contact Us Feature:
Use the built-in contact feature in the app's Profile section to reach our support team directly.
Data Protection Officer:
For privacy-specific inquiries, you can request to speak with our Data Protection Officer through the contact system.
Response Time:
We aim to respond to all privacy-related inquiries within 48 hours.
Legal Requests:
For legal or compliance requests, please include relevant documentation and specify the nature of your request.`
    }
  ];
  const ExpandableSection = ({section}) => {
    const isExpanded = expandedSections[section.id];
    return (
      <Card style={styles.sectionCard} key={section.id}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(section.id)}
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
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={SUBTITLE_COLOR}
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.sectionContent}>
            <Divider style={styles.divider} />
            <Text style={styles.contentText}>{section.content}</Text>
          </View>
        )}
      </Card>
    );
  };
  const handleContactSupport = () => {
    // Navigate to contact us screen
    navigation.navigate('ContactUs');
  };
  const handleExternalLink = (url) => {
    Linking.openURL(url).catch((err) => {
      // Handle error silently
    });
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="shield-check" size={48} color={PRIMARY_COLOR} />
          </View>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>
            Your privacy matters to us. Learn how we collect, use, and protect your data.
          </Text>
        </View>
        {/* Quick Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Quick Summary</Text>
            <Text style={styles.summaryText}>
              TrackaExpense collects only the data necessary to provide expense tracking services. 
              We use secure Firebase infrastructure, don't sell your data, and give you full control 
              over your information. Tap any section below for detailed information.
            </Text>
          </View>
        </Card>
        {/* Privacy Policy Sections */}
        <View style={styles.sectionsContainer}>
          {privacyPolicySections.map(section => (
            <ExpandableSection key={section.id} section={section} />
          ))}
        </View>
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleContactSupport}>
            <MaterialCommunityIcons name="message-text" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Contact Support</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => handleExternalLink('https://firebase.google.com/support/privacy')}>
            <MaterialCommunityIcons name="open-in-new" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.secondaryButtonText}>Firebase Privacy Policy</Text>
          </TouchableOpacity>
        </View>
        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {new Date().toLocaleDateString()}
          </Text>
          <Text style={styles.footerText}>
            TrackaExpense v1.0.1
          </Text>
        </View>
      </ScrollView>
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
    paddingBottom: 30,
  },
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 25,
  },
  headerIcon: {
    marginBottom: 15,
  },
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
    elevation: 6,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  summaryContent: {
    padding: 20,
  },
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
  sectionsContainer: {
    paddingHorizontal: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
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
  sectionContent: {
    paddingBottom: 16,
  },
  divider: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F0F0F0',
  },
  contentText: {
    fontSize: 14,
    color: TEXT_COLOR,
    fontFamily: 'Lato-Regular',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actionButtons: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  footer: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: SUBTITLE_COLOR,
    fontFamily: 'Lato-Regular',
    marginBottom: 4,
  },
});
export default PrivacyPolicyScreen;
