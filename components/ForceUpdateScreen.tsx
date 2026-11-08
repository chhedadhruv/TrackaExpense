import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {
  BACKGROUND_COLOR,
  PRIMARY_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WHITE,
} from '../src/constants/theme';
import UpdateService from '../services/UpdateService';

interface Props {
  message: string;
}

/** Full-screen block shown when the installed version is below the minimum supported version. */
const ForceUpdateScreen: React.FC<Props> = ({message}) => (
  <View style={styles.container}>
    <Text style={styles.title}>Update required</Text>
    <Text style={styles.message}>{message}</Text>
    <TouchableOpacity
      style={styles.button}
      onPress={() => UpdateService.openStorePage()}
      accessibilityRole="button"
      accessibilityLabel="Update the app">
      <Text style={styles.buttonText}>Update now</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: BACKGROUND_COLOR,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: TEXT_SECONDARY,
    marginBottom: 28,
  },
  button: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  buttonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ForceUpdateScreen;
