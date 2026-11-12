import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import Moon from 'lucide-react-native/icons/moon';
import Sun from 'lucide-react-native/icons/sun';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import {useTheme, type ThemeMode} from '../theme';
import type {AppIcon} from '../types/icons';

const OPTIONS: {mode: ThemeMode; label: string; icon: AppIcon}[] = [
  {mode: 'system', label: 'System', icon: SunMoon},
  {mode: 'light', label: 'Light', icon: Sun},
  {mode: 'dark', label: 'Dark', icon: Moon},
];

/**
 * The System / Light / Dark choice. The first component styled with NativeWind classes: the colour
 * classes (bg-surface-muted, text-text-secondary ...) read the theme variables that ThemeProvider
 * sets, so they follow the active palette with no per-theme code. Icons take a colour prop, so they
 * still read it from useTheme().
 */
const AppearanceSetting = () => {
  const {colors, mode, setMode} = useTheme();

  return (
    <View className="p-5">
      <Text className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong">
        Theme
      </Text>
      <Text className="font-sans text-sm text-text-secondary">
        Choose how TrackaExpense looks
      </Text>
      <View accessibilityRole="radiogroup" className="mt-3.5 flex-row gap-2">
        {OPTIONS.map(option => {
          const selected = mode === option.mode;
          const Icon = option.icon;
          return (
            <TouchableOpacity
              key={option.mode}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label} theme`}
              accessibilityState={{selected}}
              onPress={() => setMode(option.mode)}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-3 ${
                selected
                  ? 'border-primary-fill bg-primary-fill'
                  : 'border-card-border bg-surface-muted'
              }`}>
              <Icon
                size={18}
                color={selected ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                className={`font-sans-bold text-sm font-semibold ${
                  selected ? 'text-on-primary' : 'text-text-secondary'
                }`}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default AppearanceSetting;
