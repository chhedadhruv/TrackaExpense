import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const BACKGROUND_COLOR = '#F4F6FA';
const PRIMARY_COLOR = '#677CD2';

const InvitationsScreen = () => {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView style={styles.scrollView}>
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Invitations</Text>
            <Text style={styles.placeholderSubtitle}>No invitations yet</Text>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
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
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});

export default InvitationsScreen;


