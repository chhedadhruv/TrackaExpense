import React from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import type {AppIcon} from '../types/icons';
import {useTheme} from '../theme';

interface IconButtonSpinnerProps {
  icon: AppIcon;
  onPress: () => void;
  /** Spinner in place of the icon; presses are ignored. */
  loading?: boolean;
  /** Also ignores presses, without a spinner (another row is busy). */
  disabled?: boolean;
  color: string;
  size?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** An icon button that swaps its icon for a spinner while its request runs. */
const IconButtonSpinner = ({
  icon: Icon,
  onPress,
  loading = false,
  disabled = false,
  color,
  size = 20,
  accessibilityLabel,
  style,
}: IconButtonSpinnerProps) => {
  const {colors} = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled: loading || disabled, busy: loading}}
      style={[style, disabled && !loading && styles.dimmed]}>
      {loading ? (
        <ActivityIndicator size="small" color={color || colors.primary} />
      ) : (
        <Icon size={size} color={color} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  dimmed: {opacity: 0.5},
});

export default IconButtonSpinner;
