import React from 'react';
import {Pressable, TextInput, View} from 'react-native';
import Search from 'lucide-react-native/icons/search';
import X from 'lucide-react-native/icons/x';
import {useTheme} from '../theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

/** A single-line search box with a search icon and a clear button, in the theme's colours. */
const SearchField = ({value, onChangeText, placeholder}: SearchFieldProps) => {
  const {colors} = useTheme();
  return (
    <View className="mb-[15px] h-12 flex-row items-center rounded-xl border border-card-border bg-surface px-3.5">
      <Search size={20} color={colors.primary} />
      <TextInput
        className="ml-2.5 flex-1 py-0 font-sans text-base text-text-strong"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        selectionColor={colors.primary}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => onChangeText('')}>
          <X size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
};

export default SearchField;
