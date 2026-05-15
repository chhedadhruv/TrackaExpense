import React from 'react';
import {View, Text, TextInput, StyleSheet} from 'react-native';
import {PRIMARY_COLOR} from '../constants/theme';
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
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, disabled && styles.inputWrapperDisabled]}>
        <Text style={styles.currencySymbol}>{currencySymbol}</Text>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType="numeric"
          autoCorrect={false}
          value={formatInputAmount(value)}
          onChangeText={text => onChangeText(text.replace(/,/g, ''))}
          style={styles.input}
          editable={!disabled}
          accessibilityLabel={label ?? 'Amount'}
        />
      </View>
    </View>
  );
};

export default AmountInput;

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    color: '#333',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  inputWrapperDisabled: {
    backgroundColor: '#F5F5F5',
  },
  currencySymbol: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
    marginRight: 8,
    minWidth: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontFamily: 'Lato-Regular',
    paddingVertical: 12,
  },
});
