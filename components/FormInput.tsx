import React from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleProp,
  TextStyle,
} from 'react-native';
import {windowHeight} from '../utils/Dimentions';
import AntDesign from '@expo/vector-icons/AntDesign';
import type {AntIconName} from '../src/types/icons';
import {useTheme} from '../src/theme';

interface FormInputProps extends TextInputProps {
  labelValue?: string;
  placeholderText?: string;
  iconType?: AntIconName;
  iconSize?: number;
  /** Overrides the theme's secondary text colour for the icon. */
  iconColor?: string;
  inputStyle?: StyleProp<TextStyle>;
}

const INPUT_HEIGHT = windowHeight / 15;

/** A single-line input with an optional leading icon. Colours come from the theme. */
const FormInput = ({
  labelValue,
  placeholderText,
  iconType,
  iconSize = 25,
  iconColor,
  inputStyle,
  ...rest
}: FormInputProps) => {
  const {colors} = useTheme();
  return (
    <View
      className="mb-2.5 mt-1 w-full flex-row items-center rounded-lg border border-border bg-surface"
      style={{height: INPUT_HEIGHT}}>
      {iconType && (
        <View className="h-full w-[50px] items-center justify-center border-r border-border p-2.5">
          <AntDesign
            name={iconType}
            size={iconSize}
            color={iconColor ?? colors.textSecondary}
          />
        </View>
      )}
      <TextInput
        value={labelValue}
        className="flex-1 items-center justify-center p-2.5 font-sans text-base text-text"
        style={inputStyle}
        numberOfLines={1}
        placeholder={placeholderText}
        placeholderTextColor={colors.textPlaceholder}
        selectionColor={colors.primary}
        {...rest}
        accessibilityLabel={placeholderText}
        accessibilityHint={`Enter your ${placeholderText}`}
      />
    </View>
  );
};

export default FormInput;
