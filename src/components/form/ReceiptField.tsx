import React from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ScanText from 'lucide-react-native/icons/scan-text';
import Trash2 from 'lucide-react-native/icons/trash-2';
import {useTheme} from '../../theme';
import {FormSection} from './FormParts';

interface ReceiptFieldProps {
  /** The picked photo (a local file or a download URL), or null. */
  image: string | null;
  disabled?: boolean;
  /** Open the picker (add or change the photo). */
  onPick: () => void;
  onRemove: () => void;
  /** When given, the preview shows a "Scan receipt" button. */
  onScan?: () => void;
  scanning?: boolean;
}

/** The optional receipt photo on an expense: an empty drop area, or a preview with two actions. */
const ReceiptField = ({
  image,
  disabled = false,
  onPick,
  onRemove,
  onScan,
  scanning = false,
}: ReceiptFieldProps) => {
  const {colors} = useTheme();
  const pick = () => {
    if (!disabled) {
      onPick();
    }
  };

  return (
    <FormSection label="Receipt/Image" optional>
      {image ? (
        <View className="rounded-xl border border-card-border bg-surface-muted p-[15px]">
          <Image
            source={{uri: image}}
            className="mb-[15px] h-[200px] w-full rounded-lg"
            accessibilityLabel="Receipt photo"
          />
          <View className="flex-row justify-between">
            <TouchableOpacity
              className="flex-[0.48] flex-row items-center justify-center rounded-lg border border-primary-fill bg-surface px-4 py-3"
              accessibilityRole="button"
              onPress={pick}
              disabled={disabled}>
              <RefreshCw size={20} color={colors.primary} />
              <Text className="ml-2 font-sans-bold text-sm font-semibold text-primary">
                Change
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-[0.48] flex-row items-center justify-center rounded-lg border border-expense bg-surface px-4 py-3"
              accessibilityRole="button"
              onPress={onRemove}
              disabled={disabled}>
              <Trash2 size={20} color={colors.expense} />
              <Text className="ml-2 font-sans-bold text-sm font-semibold text-expense-text">
                Remove
              </Text>
            </TouchableOpacity>
          </View>
          {onScan ? (
            <TouchableOpacity
              className="mt-3 flex-row items-center justify-center rounded-lg bg-primary-fill px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Scan receipt to fill the amount, date and title"
              onPress={onScan}
              disabled={disabled || scanning}>
              {scanning ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <ScanText size={20} color={colors.onPrimary} />
              )}
              <Text className="ml-2 font-sans-bold text-sm font-semibold text-on-primary">
                {scanning ? 'Reading receipt...' : 'Scan receipt'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          className="items-center justify-center rounded-xl border-2 border-dashed border-card-border bg-surface-muted px-5 py-10"
          accessibilityRole="button"
          accessibilityLabel="Add receipt image"
          onPress={pick}
          disabled={disabled}>
          <ImagePlus size={32} color={colors.primary} />
          <Text className="mt-3 font-sans-bold text-base font-semibold text-primary">
            Add Receipt Image
          </Text>
          <Text className="mt-1 text-center font-sans text-sm text-text-secondary">
            Tap to take photo or choose from gallery
          </Text>
        </TouchableOpacity>
      )}
    </FormSection>
  );
};

export default ReceiptField;
