import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Sparkles from 'lucide-react-native/icons/sparkles';
import X from 'lucide-react-native/icons/x';
import {useTheme} from '../theme';
import type {Category} from '../types';
import {getCategoryIcon} from '../../utils/CategoryData';
import {filterCategories} from '../utils/categorySuggest';
import KeyboardAvoidingModal from './KeyboardAvoidingModal';
import SearchField from './SearchField';

/** Lists longer than this get a search box in the sheet. */
const SEARCH_THRESHOLD = 8;

interface CategorySelectorProps {
  categories: readonly Category[];
  selectedCategory: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  /** Values to show first, under "Suggested" (see `useCategorySuggestion`). */
  suggested?: readonly string[];
  /** The selected value is the app's guess; the field says so. */
  guessed?: boolean;
}

interface ChipProps {
  category: Category;
  selected: boolean;
  onPress: () => void;
}

const CategoryChip = ({category, selected, onPress}: ChipProps) => {
  const {colors} = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{selected}}
      className={`flex-row items-center gap-1.5 rounded-full border-[1.5px] border-primary-fill px-3.5 py-2.5 ${
        selected ? 'bg-primary-fill' : 'bg-surface'
      }`}
      onPress={onPress}>
      <category.icon
        size={22}
        color={selected ? colors.onPrimary : colors.primary}
      />
      <Text
        className={`font-sans-bold text-[13px] ${
          selected ? 'text-on-primary' : 'text-primary'
        }`}>
        {category.label}
      </Text>
    </TouchableOpacity>
  );
};

const SectionTitle = ({children}: {children: string}) => (
  <Text className="mb-2 font-sans-bold text-xs uppercase tracking-wide text-text-secondary">
    {children}
  </Text>
);

const CategorySelector = ({
  categories,
  selectedCategory,
  onSelect,
  disabled = false,
  placeholder = 'Select category',
  label,
  suggested = [],
  guessed = false,
}: CategorySelectorProps) => {
  const {colors} = useTheme();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  // A saved entry can hold a category that is not in the list (renamed, hidden or from another
  // version); show it as it is rather than as empty.
  const selected: Category | undefined = useMemo(
    () =>
      categories.find(c => c.value === selectedCategory) ??
      (selectedCategory
        ? {
            value: selectedCategory,
            label: selectedCategory,
            icon: getCategoryIcon(selectedCategory),
          }
        : undefined),
    [categories, selectedCategory],
  );

  const suggestedCategories = useMemo(
    () =>
      suggested
        .map(value => categories.find(c => c.value === value))
        .filter((c): c is Category => c !== undefined),
    [categories, suggested],
  );

  const searchable = categories.length > SEARCH_THRESHOLD;
  const searching = searchable && query.trim() !== '';
  const shown = useMemo(
    () => (searching ? filterCategories(categories, query) : categories),
    [categories, query, searching],
  );

  const close = () => {
    setVisible(false);
    setQuery('');
  };

  const choose = (value: string) => {
    onSelect(value);
    close();
  };

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
        accessibilityLabel={label ?? 'Select category'}
        accessibilityHint={
          guessed ? 'Suggested from the title. Tap to change.' : undefined
        }>
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
      {guessed && selected ? (
        <View className="mt-1 flex-row items-center gap-1">
          <Sparkles size={12} color={colors.textSecondary} />
          <Text className="font-sans text-xs text-text-secondary">
            Suggested from the title
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingModal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
        overlayStyle={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          className="bg-overlay"
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View className="max-h-[75%] rounded-t-[20px] bg-surface px-4 pb-8">
          <View className="mb-3 flex-row items-center justify-between border-b border-divider py-4">
            <Text
              accessibilityRole="header"
              className="font-sans-bold text-[17px] text-text">
              Select Category
            </Text>
            <TouchableOpacity
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {searchable ? (
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search categories"
            />
          ) : null}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {!searching && suggestedCategories.length > 0 ? (
              <View className="mb-4">
                <SectionTitle>Suggested</SectionTitle>
                <View className="flex-row flex-wrap gap-2.5">
                  {suggestedCategories.map(cat => (
                    <CategoryChip
                      key={cat.value}
                      category={cat}
                      selected={selectedCategory === cat.value}
                      onPress={() => choose(cat.value)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {!searching && suggestedCategories.length > 0 ? (
              <SectionTitle>All categories</SectionTitle>
            ) : null}
            <View className="flex-row flex-wrap gap-2.5">
              {shown.map(cat => (
                <CategoryChip
                  key={cat.value}
                  category={cat}
                  selected={selectedCategory === cat.value}
                  onPress={() => choose(cat.value)}
                />
              ))}
            </View>
            {searching && shown.length === 0 ? (
              <Text className="py-4 text-center font-sans text-sm text-text-secondary">
                No category matches "{query.trim()}"
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingModal>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {justifyContent: 'flex-end'},
});

export default CategorySelector;
