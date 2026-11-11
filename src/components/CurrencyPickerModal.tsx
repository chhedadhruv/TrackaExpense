import React from 'react';
import {Modal, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {CURRENCIES} from '../../utils/CurrencyUtil';
import {useTheme} from '../theme';
import {ModalSnackbar} from './Snackbar';

interface CurrencyPickerModalProps {
  visible: boolean;
  /** The ISO code of the currency that is selected now. */
  selectedCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

/**
 * A bottom sheet listing the supported currencies. Used on Sign up and Profile (it was a copy in
 * each). Colours come from the theme, and it renders its own snackbar host because a Modal is a
 * separate window.
 */
const CurrencyPickerModal = ({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: CurrencyPickerModalProps) => {
  const {colors} = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-overlay">
        <View className="h-[80%] max-h-[80%] rounded-t-[20px] bg-surface pb-5">
          <View className="flex-row items-center justify-between border-b border-divider p-5">
            <Text
              accessibilityRole="header"
              className="font-heading text-xl font-bold text-text-strong">
              Select Currency
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            className="px-5 pt-2.5"
            showsVerticalScrollIndicator={false}>
            {CURRENCIES.map(curr => {
              const selected = selectedCode === curr.code;
              return (
                <TouchableOpacity
                  key={curr.code}
                  accessibilityRole="radio"
                  accessibilityState={{selected}}
                  accessibilityLabel={`${curr.name}, ${curr.code}`}
                  className={`my-1 flex-row items-center justify-between rounded-xl px-4 py-4 ${
                    selected
                      ? 'border-2 border-primary-fill bg-primary-soft'
                      : 'bg-surface-muted'
                  }`}
                  onPress={() => onSelect(curr.code)}>
                  <View className="flex-1 flex-row items-center">
                    <Text
                      className="mr-4 w-14 text-center text-[28px] font-bold text-primary"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}>
                      {curr.symbol}
                    </Text>
                    <View className="flex-1">
                      <Text className="font-sans-bold text-base font-semibold text-text-strong">
                        {curr.name}
                      </Text>
                      <Text className="mt-0.5 font-sans text-sm text-text-secondary">
                        {curr.code}
                      </Text>
                    </View>
                  </View>
                  {selected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
      <ModalSnackbar />
    </Modal>
  );
};

export default CurrencyPickerModal;
