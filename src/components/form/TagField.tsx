import React, {useState} from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
// Deep imports: the package barrel would pull every icon into the bundle.
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import {useTheme} from '../../theme';
import {
  MAX_TAGS_PER_TRANSACTION,
  MAX_TAG_LENGTH,
  addTag,
  removeTag,
  suggestTags,
  tagErrorMessage,
  type TagError,
} from '../../utils/tags';
import {FormSection} from './FormParts';

interface TagFieldProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags the user has used before, most recent first, offered as suggestions. */
  knownTags: string[];
  disabled?: boolean;
}

/**
 * Free-text tags for a transaction: type a tag and press the keyboard's action key, a comma or the
 * plus button; tap a suggestion to reuse an earlier tag; tap a chip's cross to remove it. The rules
 * (limits, duplicates ignoring case) live in `src/utils/tags.ts`.
 */
const TagField = ({
  tags,
  onChange,
  knownTags,
  disabled = false,
}: TagFieldProps) => {
  const {colors} = useTheme();
  const [input, setInput] = useState('');
  const [error, setError] = useState<TagError | null>(null);

  const commit = (raw: string): void => {
    const result = addTag(tags, raw);
    if (result.error) {
      setError(result.error);
      return;
    }
    onChange(result.tags);
    setInput('');
    setError(null);
  };

  const handleChange = (text: string): void => {
    setError(null);
    if (!text.includes(',')) {
      setInput(text);
      return;
    }
    // A comma ends a tag; a pasted "a,b,c" adds a and b and leaves c in the box.
    const parts = text.split(',');
    const rest = parts.pop() ?? '';
    let next = tags;
    let firstError: TagError | null = null;
    for (const part of parts) {
      if (!part.trim()) {
        continue;
      }
      const result = addTag(next, part);
      if (result.error) {
        firstError = firstError ?? result.error;
      } else {
        next = result.tags;
      }
    }
    if (next !== tags) {
      onChange(next);
    }
    setInput(rest);
    setError(firstError);
  };

  const suggestions = suggestTags(knownTags, input, tags);
  const full = tags.length >= MAX_TAGS_PER_TRANSACTION;

  return (
    <FormSection label="Tags" optional>
      {tags.length > 0 ? (
        <View className="mb-1 flex-row flex-wrap">
          {tags.map(tag => (
            <View
              key={tag}
              className="mb-2 mr-2 flex-row items-center rounded-full bg-primary-soft py-1.5 pl-3 pr-2">
              <Text className="font-sans-bold text-sm font-semibold text-primary">
                {tag}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${tag}`}
                disabled={disabled}
                hitSlop={8}
                className="ml-1.5"
                onPress={() => onChange(removeTag(tags, tag))}>
                <X size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center rounded-xl border border-card-border bg-surface-muted px-[15px] py-2.5">
        <TextInput
          value={input}
          onChangeText={handleChange}
          onSubmitEditing={() => commit(input)}
          blurOnSubmit={false}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={full ? 'Tag limit reached' : 'Add a tag'}
          placeholderTextColor={colors.textPlaceholder}
          selectionColor={colors.primary}
          className="flex-1 font-sans text-base text-text-strong"
          editable={!disabled && !full}
          maxLength={MAX_TAG_LENGTH + 1}
          accessibilityLabel="Add a tag"
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add tag"
          accessibilityState={{disabled: disabled || full || !input.trim()}}
          disabled={disabled || full || !input.trim()}
          hitSlop={8}
          onPress={() => commit(input)}>
          <Plus
            size={22}
            color={
              disabled || full || !input.trim()
                ? colors.textPlaceholder
                : colors.primary
            }
          />
        </TouchableOpacity>
      </View>

      <View className="mt-1 flex-row justify-between">
        <Text
          accessibilityRole={error ? 'alert' : undefined}
          className="flex-1 font-sans text-xs text-expense-text">
          {error ? tagErrorMessage(error) : ''}
        </Text>
        <Text className="font-sans text-xs text-text-placeholder">
          {tags.length}/{MAX_TAGS_PER_TRANSACTION}
        </Text>
      </View>

      {suggestions.length > 0 && !full ? (
        <View className="mt-2 flex-row flex-wrap">
          {suggestions.map(suggestion => (
            <TouchableOpacity
              key={suggestion}
              accessibilityRole="button"
              accessibilityLabel={`Add tag ${suggestion}`}
              disabled={disabled}
              className="mb-2 mr-2 flex-row items-center rounded-full border border-card-border bg-surface px-3 py-1.5"
              onPress={() => commit(suggestion)}>
              <Plus size={12} color={colors.textSecondary} />
              <Text className="ml-1 font-sans text-sm text-text-secondary">
                {suggestion}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </FormSection>
  );
};

export default TagField;
