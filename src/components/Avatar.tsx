import React from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

const PALETTE = [
  '#677CD2',
  '#E0766A',
  '#4FB286',
  '#D49A3F',
  '#8E6BBF',
  '#3FA7B8',
  '#C7648F',
  '#6C8B3F',
];

interface AvatarProps {
  size?: number;
  name?: string | null;
  src?: string | null;
  bgColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const getInitials = (name?: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const colorForName = (name?: string | null): string => {
  const text = name ?? '';
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000;
  }
  return PALETTE[hash % PALETTE.length];
};

const Avatar = ({size = 48, name, src, bgColor, style}: AvatarProps) => {
  const base = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (src) {
    return <Image source={{uri: src}} style={[base, style as object]} />;
  }

  return (
    <View
      style={[
        styles.container,
        base,
        {backgroundColor: bgColor ?? colorForName(name)},
        style,
      ]}>
      <Text style={[styles.text, {fontSize: size * 0.4}]}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

export default Avatar;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
