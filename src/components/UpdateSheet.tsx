import React from 'react';
import {Pressable, Text, TouchableOpacity, View} from 'react-native';
import Animated, {SlideInDown} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import {useTheme} from '../theme';
import KeyboardAvoidingModal from './KeyboardAvoidingModal';

// The dimmed layer fills the window; the sheet sits at its bottom edge.
const OVERLAY = {justifyContent: 'flex-end'} as const;
const MIN_BOTTOM_PADDING = 20;

interface UpdateSheetProps {
  visible: boolean;
  /** True while the restart is under way: the buttons are disabled. */
  restarting: boolean;
  onRestart: () => void;
  onLater: () => void;
}

/**
 * The sheet a signed-in person sees when an over-the-air update has been downloaded: restart
 * into it now, or later (it then applies on the next start of the app). It never appears before
 * the download is complete, so "Restart now" takes a moment, not a download.
 */
const UpdateSheet = ({
  visible,
  restarting,
  onRestart,
  onLater,
}: UpdateSheetProps) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onLater}
      overlayStyle={OVERLAY}>
      <Pressable
        className="absolute inset-0 bg-overlay"
        accessibilityLabel="Later"
        onPress={onLater}
      />
      <Animated.View entering={SlideInDown.duration(250)}>
        <View
          className="rounded-t-3xl bg-surface px-5 pt-3"
          style={{
            paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_PADDING),
          }}>
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
          <View className="mb-5 flex-row items-center gap-3.5">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
              <RefreshCw size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text
                accessibilityRole="header"
                className="font-sans-bold text-lg text-text">
                Update ready
              </Text>
              <Text className="mt-0.5 font-sans text-sm text-text-secondary">
                A newer version of TrackaExpense has been downloaded. Restart
                the app to use it.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            className="mb-2.5 items-center rounded-xl bg-primary-fill p-3.5"
            accessibilityRole="button"
            accessibilityState={{disabled: restarting, busy: restarting}}
            disabled={restarting}
            onPress={onRestart}>
            <Text className="font-sans-bold text-base text-on-primary">
              {restarting ? 'Restarting...' : 'Restart now'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="items-center rounded-xl border border-border p-3.5"
            accessibilityRole="button"
            accessibilityState={{disabled: restarting}}
            disabled={restarting}
            onPress={onLater}>
            <Text className="font-sans-bold text-base text-text">Later</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingModal>
  );
};

export default UpdateSheet;
