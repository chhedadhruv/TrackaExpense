import React from 'react';
import {View, type ColorValue} from 'react-native';
import {BottomTabBar, type BottomTabBarProps} from 'expo-router/js-tabs';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import House from 'lucide-react-native/icons/house';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
import User from 'lucide-react-native/icons/user';
import {setSnackbarBottomOffset} from '../utils/snackbarStore';
import type {AppIcon} from '../types/icons';

/** Reports the tab bar height so the snackbar floats just above it. */
const MeasuredTabBar = (props: BottomTabBarProps) => {
  React.useEffect(() => () => setSnackbarBottomOffset(0), []);
  return (
    <View
      onLayout={event =>
        setSnackbarBottomOffset(event.nativeEvent.layout.height)
      }>
      <BottomTabBar {...props} />
    </View>
  );
};

export const renderTabBar = (props: BottomTabBarProps) => (
  <MeasuredTabBar {...props} />
);

interface TabIconProps {
  color: ColorValue;
  size: number;
  focused: boolean;
}

/**
 * Tab bar icon renderers. They live at module level so no component is defined while rendering
 * (a function written inline in the options would be a new component type every time). Each takes
 * the active colour and returns the renderer the tab bar calls.
 */
const tabIcon =
  (Icon: AppIcon) =>
  (activeColor: string) =>
  ({color, size, focused}: TabIconProps) =>
    <Icon color={(focused ? activeColor : color) as string} size={size} />;

export const tabIcons = {
  home: tabIcon(House),
  statistic: tabIcon(ChartColumn),
  split: tabIcon(ArrowLeftRight),
  savings: tabIcon(PiggyBank),
  profile: tabIcon(User),
};
