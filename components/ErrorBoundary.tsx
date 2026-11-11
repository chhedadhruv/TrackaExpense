import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {getCrashlytics, log} from '@react-native-firebase/crashlytics';
import {reportError} from '../src/services/ErrorReporter';
import {useThemedStyles, type ThemeColors} from '../src/theme';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

interface FallbackProps {
  message: string;
  onReset: () => void;
}

/** The default error screen. A function component so it can read the theme. */
const ErrorFallback = ({message, onReset}: FallbackProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.subtitle}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={onReset}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = {hasError: false, error: null};

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, {componentStack: info.componentStack ?? ''});
    log(getCrashlytics(), `Component stack: ${info.componentStack}`);
  }

  handleReset = () => this.setState({hasError: false, error: null});

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          message={this.state.error?.message || 'An unexpected error occurred'}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textStrong,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 20,
    },
    button: {
      backgroundColor: colors.primaryFill,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default ErrorBoundary;
