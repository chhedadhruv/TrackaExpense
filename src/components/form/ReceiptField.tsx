import React from 'react';
import {Image, Text, TouchableOpacity, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useTheme} from '../../theme';
import {FormSection} from './FormParts';

interface ReceiptFieldProps {
  /** The picked photo (a local file or a download URL), or null. */
  image: string | null;
  disabled?: boolean;
  /** Open the picker (add or change the photo). */
  onPick: () => void;
  onRemove: () => void;
}

/** The optional receipt photo on an expense: an empty drop area, or a preview with two actions. */
const ReceiptField = ({
  image,
  disabled = false,
  onPick,
  onRemove,
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
              <MaterialCommunityIcons
                name="camera-switch"
                size={20}
                color={colors.primary}
              />
              <Text className="ml-2 font-sans-bold text-sm font-semibold text-primary">
                Change
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-[0.48] flex-row items-center justify-center rounded-lg border border-expense bg-surface px-4 py-3"
              accessibilityRole="button"
              onPress={onRemove}
              disabled={disabled}>
              <MaterialCommunityIcons
                name="delete"
                size={20}
                color={colors.expense}
              />
              <Text className="ml-2 font-sans-bold text-sm font-semibold text-expense-text">
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          className="items-center justify-center rounded-xl border-2 border-dashed border-card-border bg-surface-muted px-5 py-10"
          accessibilityRole="button"
          accessibilityLabel="Add receipt image"
          onPress={pick}
          disabled={disabled}>
          <MaterialCommunityIcons
            name="camera-plus"
            size={32}
            color={colors.primary}
          />
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
