import React, {useState} from 'react';
import {View, Text, TouchableOpacity, Modal, StyleSheet} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {PRIMARY_COLOR} from '../constants/theme';
import type {Category} from '../types';

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
  const [visible, setVisible] = useState(false);

  const selected = categories.find(c => c.value === selectedCategory);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select category'}>
        {selected ? (
          <>
            <MaterialCommunityIcons
              name={selected.icon}
              size={20}
              color={PRIMARY_COLOR}
            />
            <Text style={styles.triggerText}>{selected.label}</Text>
          </>
        ) : (
          <Text style={styles.triggerPlaceholder}>{placeholder}</Text>
        )}
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color="#999"
          style={styles.chevron}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.grid}>
              {categories.map(cat => {
                const isSelected = selectedCategory === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => {
                      onSelect(cat.value);
                      setVisible(false);
                    }}>
                    <MaterialCommunityIcons
                      name={cat.icon}
                      size={22}
                      color={isSelected ? '#FFFFFF' : PRIMARY_COLOR}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default CategorySelector;

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
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  triggerText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#333',
    fontFamily: 'Lato-Regular',
  },
  triggerPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: '#999',
    fontFamily: 'Lato-Regular',
  },
  chevron: {
    marginLeft: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: 'Lato-Bold',
    color: '#333',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  chipText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});
