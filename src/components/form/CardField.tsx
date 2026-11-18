import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import type {CardDocument} from '../../utils/cards';
import {FormSection} from './FormParts';

interface CardFieldProps {
  /** The cards to choose from (archived ones left out by the caller, except the selected one). */
  cards: CardDocument[];
  /** The chosen card id, or null for cash, UPI or a bank account (the default). */
  value: string | null;
  onChange: (cardId: string | null) => void;
  disabled?: boolean;
}

/**
 * "Paid with": Cash / UPI first and selected by default, then one chip per card. Nothing here
 * remembers the last choice, so a card is only ever picked on purpose.
 */
const CardField = ({
  cards,
  value,
  onChange,
  disabled = false,
}: CardFieldProps) => {
  const options: {id: string | null; label: string}[] = [
    {id: null, label: 'Cash / UPI'},
    ...cards.map(c => ({
      id: c.id,
      label: c.last4 ? `${c.name} ${c.last4}` : c.name,
    })),
  ];
  return (
    <FormSection label="Paid with">
      <View className="flex-row flex-wrap">
        {options.map(option => {
          const selected = option.id === value;
          return (
            <TouchableOpacity
              key={option.id ?? 'cash'}
              accessibilityRole="radio"
              accessibilityState={{selected, disabled}}
              disabled={disabled}
              onPress={() => onChange(option.id)}
              className={`mb-2 mr-2 rounded-full border px-4 py-2 ${
                selected
                  ? 'border-primary bg-primary-soft'
                  : 'border-card-border bg-surface'
              }`}>
              <Text
                className={`font-sans-bold text-sm ${
                  selected ? 'text-primary' : 'text-text-secondary'
                }`}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </FormSection>
  );
};

export default CardField;
