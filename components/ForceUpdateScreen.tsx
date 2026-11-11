import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useThemedStyles, type ThemeColors} from '../src/theme';
import UpdateService from '../services/UpdateService';

interface Props {
  message: string;
}

/** Full-screen block shown when the installed version is below the minimum supported version. */
const ForceUpdateScreen: React.FC<Props> = ({message}) => {
  const styles = useThemedStyles(createStyles);
  return (
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
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    message: {
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
      color: colors.textSecondary,
      marginBottom: 28,
    },
    button: {
      backgroundColor: colors.primaryFill,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 36,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default ForceUpdateScreen;
