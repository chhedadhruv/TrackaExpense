import React from 'react';
import {View, Text, TextInput} from 'react-native';
import {useTheme} from '../theme';
import {formatInputAmount} from '../utils/formatters';

interface AmountInputProps {
  /** Raw numeric string without commas — strip commas before storing in state */
  value: string;
  onChangeText: (raw: string) => void;
  currencySymbol: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

const AmountInput = ({
  value,
  onChangeText,
  currencySymbol,
  disabled = false,
  label,
  placeholder = 'Enter amount',
}: AmountInputProps) => {
  const {colors} = useTheme();
  return (
    <View className="mb-2">
      {label && (
        <Text className="mb-1.5 font-sans-bold text-sm text-text">{label}</Text>
      )}
      <View
        className={`min-h-[48px] flex-row items-center rounded-[10px] border border-border px-3.5 ${
          disabled ? 'bg-surface-muted' : 'bg-surface'
        }`}>
        <Text className="mr-2 min-w-[20px] font-sans-bold text-base text-primary">
          {currencySymbol}
        </Text>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          selectionColor={colors.primary}
          keyboardType="numeric"
          autoCorrect={false}
          value={formatInputAmount(value)}
          onChangeText={text => onChangeText(text.replace(/,/g, ''))}
          className="flex-1 py-3 font-sans text-base text-text"
          editable={!disabled}
          accessibilityLabel={label ?? 'Amount'}
        />
      </View>
    </View>
  );
};

export default AmountInput;
