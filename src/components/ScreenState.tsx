import React from 'react';
import {ActivityIndicator, Text, TouchableOpacity, View} from 'react-native';
// Deep imports: the package barrel would pull every icon into the bundle.
import Inbox from 'lucide-react-native/icons/inbox';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import type {LucideIcon} from 'lucide-react-native';
import {useTheme} from '../theme';

/**
 * The three states every data screen needs besides its content:
 *
 * - LoadingState: the first load is running.
 * - ErrorState: the load failed. Say so and offer Retry; never show an empty message for a
 *   failure (a failed balance load must not read "All settled up").
 * - EmptyState: the load worked and there is nothing to show.
 *
 * `fill` makes the block take the whole screen (a screen that has nothing else to show); without it
 * the block is padded and sits inside a list or a card.
 */

interface BaseProps {
  fill?: boolean;
}

const containerClass = (fill: boolean | undefined): string =>
  fill
    ? 'flex-1 items-center justify-center bg-background px-8'
    : 'items-center justify-center px-5 py-[60px]';

interface LoadingStateProps extends BaseProps {
  message?: string;
}

export const LoadingState = ({message, fill = true}: LoadingStateProps) => {
  const {colors} = useTheme();
  return (
    <View className={containerClass(fill)} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <Text className="mt-[15px] font-sans text-base text-primary">
          {message}
        </Text>
      ) : null}
    </View>
  );
};

interface EmptyStateProps extends BaseProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
}

export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  message,
  fill = false,
}: EmptyStateProps) => {
  const {colors} = useTheme();
  return (
    <View className={containerClass(fill)}>
      <Icon size={56} color={colors.iconMuted} strokeWidth={1.5} />
      <Text className="mt-4 text-center font-sans-bold text-lg font-bold text-text-strong">
        {title}
      </Text>
      {message ? (
        <Text className="mt-2 text-center font-sans text-sm text-text-secondary">
          {message}
        </Text>
      ) : null}
    </View>
  );
};

interface ErrorStateProps extends BaseProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  /** True while a retry is running, so the button cannot be pressed twice. */
  retrying?: boolean;
}

export const ErrorState = ({
  title = 'Could not load this',
  message = 'Check your connection and try again.',
  onRetry,
  retrying = false,
  fill = true,
}: ErrorStateProps) => {
  const {colors} = useTheme();
  return (
    <View className={containerClass(fill)} accessibilityRole="alert">
      <TriangleAlert size={56} color={colors.expense} strokeWidth={1.5} />
      <Text className="mt-4 text-center font-sans-bold text-lg font-bold text-text-strong">
        {title}
      </Text>
      <Text className="mt-2 text-center font-sans text-sm text-text-secondary">
        {message}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Try again"
        accessibilityState={{disabled: retrying}}
        disabled={retrying}
        onPress={onRetry}
        className="mt-6 flex-row items-center rounded-xl bg-primary-fill px-6 py-3">
        {retrying ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <RefreshCw size={18} color={colors.onPrimary} />
        )}
        <Text className="ml-2 font-sans-bold text-base font-semibold text-on-primary">
          Try again
        </Text>
      </TouchableOpacity>
    </View>
  );
};
