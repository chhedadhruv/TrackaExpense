import React, {useState} from 'react';
import {View, Text, TouchableOpacity, Modal, ScrollView} from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import X from 'lucide-react-native/icons/x';
import {useTheme} from '../theme';
import type {Category} from '../types';
import {ModalSnackbar} from './Snackbar';

interface CategorySelectorProps {
  categories: readonly Category[];
  selectedCategory: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}

const CategorySelector = ({
  categories,
  selectedCategory,
  onSelect,
  disabled = false,
  placeholder = 'Select category',
  label,
}: CategorySelectorProps) => {
  const {colors} = useTheme();
  const [visible, setVisible] = useState(false);

  const selected = categories.find(c => c.value === selectedCategory);

  return (
    <View className="mb-2">
      {label && (
        <Text className="mb-1.5 font-sans-bold text-sm text-text">{label}</Text>
      )}
      <TouchableOpacity
        className="min-h-[48px] flex-row items-center rounded-[10px] border border-border bg-surface px-3.5 py-[13px]"
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select category'}>
        {selected ? (
          <>
            <selected.icon size={20} color={colors.primary} />
            <Text className="ml-2.5 flex-1 font-sans text-[15px] text-text">
              {selected.label}
            </Text>
          </>
        ) : (
          <Text className="flex-1 font-sans text-[15px] text-text-placeholder">
            {placeholder}
          </Text>
        )}
        <View className="ml-1">
          <ChevronDown size={20} color={colors.textPlaceholder} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}>
        <TouchableOpacity
          className="flex-1 justify-end bg-overlay"
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View className="max-h-[70%] rounded-t-[20px] bg-surface px-4 pb-8">
            <View className="mb-3 flex-row items-center justify-between border-b border-divider py-4">
              <Text
                accessibilityRole="header"
                className="font-sans-bold text-[17px] text-text">
                Select Category
              </Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap gap-2.5">
                {categories.map(cat => {
                  const isSelected = selectedCategory === cat.value;
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      accessibilityRole="radio"
                      accessibilityState={{selected: isSelected}}
                      className={`flex-row items-center gap-1.5 rounded-full border-[1.5px] border-primary-fill px-3.5 py-2.5 ${
                        isSelected ? 'bg-primary-fill' : 'bg-surface'
                      }`}
                      onPress={() => {
                        onSelect(cat.value);
                        setVisible(false);
                      }}>
                      <cat.icon
                        size={22}
                        color={isSelected ? colors.onPrimary : colors.primary}
                      />
                      <Text
                        className={`font-sans-bold text-[13px] ${
                          isSelected ? 'text-on-primary' : 'text-primary'
                        }`}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
        <ModalSnackbar />
      </Modal>
    </View>
  );
};

export default CategorySelector;
