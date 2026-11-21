import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import History from 'lucide-react-native/icons/history';
import {useTheme} from '../../theme';
import type {TitleEntry} from '../../utils/titleSuggest';

interface Props {
  suggestions: readonly TitleEntry[];
  onPick: (entry: TitleEntry) => void;
  disabled?: boolean;
}

/** The person's past titles matching the title field, as tappable chips under it. */
const TitleSuggestions = ({suggestions, onPick, disabled = false}: Props) => {
  const {colors} = useTheme();
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <View className="mt-2 flex-row flex-wrap">
      {suggestions.map(entry => (
        <TouchableOpacity
          key={entry.key}
          accessibilityRole="button"
          accessibilityLabel={`Use title ${entry.title}`}
          disabled={disabled}
          className="mb-2 mr-2 max-w-full flex-row items-center rounded-full border border-card-border bg-surface px-3 py-1.5"
          onPress={() => onPick(entry)}>
          <History size={12} color={colors.textSecondary} />
          <Text
            numberOfLines={1}
            className="ml-1 shrink font-sans text-sm text-text-secondary">
            {entry.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default TitleSuggestions;
