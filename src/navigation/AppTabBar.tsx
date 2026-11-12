import React from 'react';
import {View, type ColorValue} from 'react-native';
import {BottomTabBar, type BottomTabBarProps} from 'expo-router/js-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import FeatherIcons from '@expo/vector-icons/Feather';
import {setSnackbarBottomOffset} from '../utils/snackbarStore';

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
export const tabIcons = {
  home:
    (activeColor: string) =>
    ({color, size, focused}: TabIconProps) =>
      (
        <MaterialCommunityIcons
          name="home"
          color={(focused ? activeColor : color) as string}
          size={size}
        />
      ),
  statistic:
    (activeColor: string) =>
    ({color, size, focused}: TabIconProps) =>
      (
        <FeatherIcons
          name="bar-chart-2"
          color={(focused ? activeColor : color) as string}
          size={size}
        />
      ),
  split:
    (activeColor: string) =>
    ({color, size, focused}: TabIconProps) =>
      (
        <FontAwesome6
          name="money-bill-transfer"
          color={(focused ? activeColor : color) as string}
          size={size}
        />
      ),
  savings:
    (activeColor: string) =>
    ({color, size, focused}: TabIconProps) =>
      (
        <MaterialCommunityIcons
          name="piggy-bank"
          color={(focused ? activeColor : color) as string}
          size={size}
        />
      ),
  profile:
    (activeColor: string) =>
    ({color, size, focused}: TabIconProps) =>
      (
        <Ionicons
          name="person-outline"
          color={(focused ? activeColor : color) as string}
          size={size}
        />
      ),
};
