import React, {useEffect, useSyncExternalStore} from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {useReanimatedKeyboardAnimation} from 'react-native-keyboard-controller';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  CircleAlert,
  CircleCheck,
  Info,
  type LucideIcon,
} from 'lucide-react-native';
import {
  EXPENSE_COLOR,
  FONT,
  PRIMARY_COLOR,
  SUCCESS_COLOR,
  TEXT_DARK,
  WHITE,
} from '../constants/theme';
import {
  dismissSnackbar,
  getSnackbarState,
  subscribeSnackbar,
  type SnackbarItem,
  type SnackbarVariant,
} from '../utils/snackbarStore';

const MARGIN = 12;
const MAX_WIDTH = 560;

const VARIANT: Record<SnackbarVariant, {Icon: LucideIcon; color: string}> = {
  success: {Icon: CircleCheck, color: SUCCESS_COLOR},
  error: {Icon: CircleAlert, color: EXPENSE_COLOR},
  info: {Icon: Info, color: PRIMARY_COLOR},
};

const useSnackbarState = () =>
  useSyncExternalStore(subscribeSnackbar, getSnackbarState, getSnackbarState);

interface SnackbarViewProps {
  item: SnackbarItem;
}

/** The bar itself: icon, message, optional action. Tap anywhere to dismiss. */
export const SnackbarView = ({item}: SnackbarViewProps) => {
  const {Icon, color} = VARIANT[item.variant];

  useEffect(() => {
    // iOS VoiceOver does not read a view that appears; announce it. Android uses the live region.
    AccessibilityInfo.announceForAccessibility(item.message);
  }, [item.id, item.message]);

  const handleAction = () => {
    const onPress = item.action?.onPress;
    dismissSnackbar();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLiveRegion={
        item.variant === 'error' ? 'assertive' : 'polite'
      }
      accessibilityLabel={item.message}
      accessibilityHint="Double tap to dismiss"
      onPress={dismissSnackbar}
      style={styles.bar}>
      <View style={[styles.accent, {backgroundColor: color}]} />
      <Icon size={20} color={color} strokeWidth={2.25} />
      <Text style={styles.message} numberOfLines={3}>
        {item.message}
      </Text>
      {item.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.action.label}
          hitSlop={8}
          onPress={handleAction}
          style={styles.actionButton}>
          <Text style={[styles.actionText, {color}]}>{item.action.label}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
};

/**
 * Mount once, near the root (App.tsx), after the navigators so it draws on top. It floats above
 * the tab bar (reported through setSnackbarBottomOffset) and lifts above the keyboard.
 *
 * It lives in the main window: a React Native Modal is a separate window and hides it, so show a
 * snackbar after the modal has closed.
 */
export const SnackbarHost = () => {
  const {current, bottomOffset} = useSnackbarState();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();

  // With a tab bar the offset already includes the bottom inset; without one add it here.
  const base = (bottomOffset > 0 ? bottomOffset : insets.bottom) + MARGIN;

  const liftStyle = useAnimatedStyle(() => {
    // keyboard.height is negative while the keyboard is open (minus its height).
    const lift = Math.max(0, -keyboard.height.value - base);
    return {transform: [{translateY: -lift}]};
  }, [base]);

  const positionStyle: ViewStyle = {bottom: base};

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {current ? (
        <Animated.View
          key={current.id}
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          style={[styles.host, positionStyle, liftStyle]}>
          <SnackbarView item={current} />
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: TEXT_DARK,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  message: {
    flex: 1,
    color: WHITE,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },
  actionButton: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
  actionText: {
    fontSize: 14,
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
});
