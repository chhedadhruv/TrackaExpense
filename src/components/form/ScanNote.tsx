import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useCurrency} from '../../../utils/CurrencyUtil';

interface ScanNoteProps {
  /** What the scan filled in, e.g. ["amount", "date"]; empty when it found nothing. */
  filled: string[];
  /** Other totals found on the receipt, tappable if the filled one is wrong. */
  alternatives: string[];
  onPickAmount: (amount: string) => void;
}

/** The message under the receipt after a scan: what was filled, and a reminder to check it. */
const ScanNote = ({filled, alternatives, onPickAmount}: ScanNoteProps) => {
  const {currency} = useCurrency();
  return (
    <View
      className="mt-3 rounded-lg border border-card-border bg-surface-muted p-3"
      accessibilityLiveRegion="polite">
      <Text className="font-sans text-sm text-text">
        {filled.length > 0
          ? `Filled the ${filled.join(
              ', ',
            )} from your receipt. Please check them before saving.`
          : 'Nothing could be read from this receipt. Enter the details by hand.'}
      </Text>
      {alternatives.length > 0 ? (
        <View className="mt-2">
          <Text className="font-sans text-xs text-text-secondary">
            Other amounts found, tap to use one:
          </Text>
          <View className="mt-1 flex-row flex-wrap">
            {alternatives.map(amount => (
              <TouchableOpacity
                key={amount}
                className="mb-1 mr-2 rounded-full border border-primary-fill px-3 py-1"
                accessibilityRole="button"
                accessibilityLabel={`Use amount ${amount}`}
                onPress={() => onPickAmount(amount)}>
                <Text className="font-sans-bold text-sm text-primary">
                  {currency.symbol} {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default ScanNote;
