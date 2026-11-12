import React from 'react';
import {Text as NativeText, type TextProps} from 'react-native';
import {useTheme} from '../theme';

/**
 * React Native's Text with the theme's body colour as the default, so text that sets no colour
 * of its own is readable on both the light and the dark theme (a bare Text is black). A style
 * passed in wins.
 */
const Text = ({style, ...props}: TextProps) => {
  const {colors} = useTheme();
  return <NativeText style={[{color: colors.text}, style]} {...props} />;
};

export default Text;
