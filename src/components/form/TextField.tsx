import React from 'react';
import {Text, TextInput, View, type TextInputProps} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useTheme} from '../../theme';
import type {McIconName} from '../../types/icons';
import {FormSection} from './FormParts';

interface TextFieldProps
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'placeholder' | 'multiline' | 'numberOfLines'
  > {
  label: string;
  optional?: boolean;
  icon: McIconName;
  maxLength: number;
  disabled?: boolean;
}

const TOP_ALIGNED = {textAlignVertical: 'top'} as const;

/** A labelled text input with a leading icon and a character counter. */
const TextField = ({
  label,
  optional,
  icon,
  maxLength,
  disabled = false,
  value = '',
  ...inputProps
}: TextFieldProps) => {
  const {colors} = useTheme();
  return (
    <FormSection label={label} optional={optional}>
      <View className="flex-row items-center rounded-xl border border-card-border bg-surface-muted px-[15px] py-2.5">
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={colors.primary}
          className="mr-3"
        />
        <TextInput
          {...inputProps}
          value={value}
          autoCorrect={false}
          placeholderTextColor={colors.textPlaceholder}
          selectionColor={colors.primary}
          className="flex-1 font-sans text-base text-text-strong"
          style={TOP_ALIGNED}
          editable={!disabled}
          maxLength={maxLength}
          accessibilityLabel={label}
        />
      </View>
      <Text className="mt-1 text-right font-sans text-xs text-text-placeholder">
        {value.length}/{maxLength}
      </Text>
    </FormSection>
  );
};

export default TextField;
