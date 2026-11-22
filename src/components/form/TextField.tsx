import React from 'react';
import {Text, TextInput, View, type TextInputProps} from 'react-native';
import {useTheme} from '../../theme';
import type {AppIcon} from '../../types/icons';
import {FormSection} from './FormParts';

interface TextFieldProps
  extends Pick<
    TextInputProps,
    | 'value'
    | 'onChangeText'
    | 'placeholder'
    | 'multiline'
    | 'numberOfLines'
    | 'onFocus'
    | 'onBlur'
  > {
  label: string;
  optional?: boolean;
  icon: AppIcon;
  maxLength: number;
  disabled?: boolean;
  /** Shown under the field, before the counter (for example title suggestions). */
  children?: React.ReactNode;
}

const TOP_ALIGNED = {textAlignVertical: 'top'} as const;

/** A labelled text input with a leading icon and a character counter. */
const TextField = ({
  label,
  optional,
  icon: Icon,
  maxLength,
  disabled = false,
  value = '',
  children,
  ...inputProps
}: TextFieldProps) => {
  const {colors} = useTheme();
  return (
    <FormSection label={label} optional={optional}>
      <View className="flex-row items-center rounded-xl border border-card-border bg-surface-muted px-[15px] py-2.5">
        <View className="mr-3">
          <Icon size={20} color={colors.primary} />
        </View>
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
      {children}
      <Text className="mt-1 text-right font-sans text-xs text-text-placeholder">
        {value.length}/{maxLength}
      </Text>
    </FormSection>
  );
};

export default TextField;
