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
// Deep imports: the package barrel would pull every icon (about 4,700 modules) into the bundle.
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Info from 'lucide-react-native/icons/info';
import type {LucideIcon} from 'lucide-react-native';
import {FONT} from '../constants/theme';
import {useTheme, useThemedStyles, type ThemeColors} from '../theme';
import {
  dismissSnackbar,
  getSnackbarState,
  registerSnackbarModal,
  subscribeSnackbar,
  type SnackbarItem,
  type SnackbarVariant,
} from '../utils/snackbarStore';

const MARGIN = 12;
const MAX_WIDTH = 560;
// An edge-to-edge modal window reports a bottom inset of 0 even with gesture navigation, so keep
// the bar clear of the gesture pill with a floor.
const MODAL_MIN_BOTTOM_INSET = 24;

const VARIANT_ICON: Record<SnackbarVariant, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

const variantColor = (
  variant: SnackbarVariant,
  colors: ThemeColors,
): string => {
  if (variant === 'success') {
    return colors.success;
  }
  if (variant === 'error') {
    return colors.expense;
  }
  return colors.primary;
};

const useSnackbarState = () =>
  useSyncExternalStore(subscribeSnackbar, getSnackbarState, getSnackbarState);

interface SnackbarViewProps {
  item: SnackbarItem;
}

/** The bar itself: icon, message, optional action. Tap anywhere to dismiss. */
export const SnackbarView = ({item}: SnackbarViewProps) => {
  const {colors} = useTheme();
  const styles = useThemedStyles(createBarStyles);
  const Icon = VARIANT_ICON[item.variant];
  const color = variantColor(item.variant, colors);

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
 * Draws the current snackbar. Mount it once near the root (App.tsx), after the navigators so it
 * draws on top: it floats above the tab bar (reported through setSnackbarBottomOffset) and lifts
 * above the keyboard.
 *
 * A React Native Modal is a separate window that covers the root host, so every Modal also
 * renders <ModalSnackbar />; while any modal is open only that host draws.
 */
interface SnackbarHostProps {
  /** True for the host inside a modal: it ignores the tab bar and the root host's keyboard lift. */
  inModal?: boolean;
}

export const SnackbarHost = ({inModal = false}: SnackbarHostProps) => {
  const {current, bottomOffset, modalDepth} = useSnackbarState();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();

  // With a tab bar the offset already includes the bottom inset; without one add it here. A modal
  // covers the tab bar, so inside one only the inset counts.
  const bottomInset = inModal
    ? Math.max(insets.bottom, MODAL_MIN_BOTTOM_INSET)
    : insets.bottom;
  const base =
    (!inModal && bottomOffset > 0 ? bottomOffset : bottomInset) + MARGIN;

  const liftStyle = useAnimatedStyle(() => {
    // keyboard.height is negative while the keyboard is open (minus its height). A modal built on
    // KeyboardAvoidingModal already moves its content above the keyboard, so it needs no lift.
    const lift = inModal ? 0 : Math.max(0, -keyboard.height.value - base);
    return {transform: [{translateY: -lift}]};
  }, [base, inModal]);

  // Exactly one host draws: the root one while no modal is open, the modal's own otherwise.
  const visible = inModal ? modalDepth > 0 : modalDepth === 0;
  const positionStyle: ViewStyle = {bottom: base};

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {current && visible ? (
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

/**
 * Put this as the last child of the root view inside every React Native Modal so the snackbar is
 * visible while the modal is open (the root host sits in another window, behind the modal).
 */
export const ModalSnackbar = () => {
  useEffect(() => registerSnackbarModal(), []);
  return <SnackbarHost inModal />;
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN,
    alignItems: 'center',
  },
});

const createBarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      backgroundColor: colors.snackbarBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.snackbarBorder,
      shadowColor: colors.shadow,
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
      color: colors.snackbarText,
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
