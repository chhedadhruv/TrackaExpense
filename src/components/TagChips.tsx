import React from 'react';
import {Text, View} from 'react-native';
import {sanitizeTags} from '../utils/tags';

interface TagChipsProps {
  /** A transaction's `tags` field as stored; anything unusable is ignored. */
  tags: unknown;
  /** Show at most this many chips, then a "+n" chip for the rest. */
  max?: number;
  /** Extra layout classes for the chip row (for example a top margin). */
  className?: string;
}

/** Read-only tag chips for a transaction row or detail screen. Renders nothing without tags. */
const TagChips = ({tags, max, className = ''}: TagChipsProps) => {
  const clean = sanitizeTags(tags);
  if (clean.length === 0) {
    return null;
  }
  const shown = max !== undefined ? clean.slice(0, max) : clean;
  const hidden = clean.length - shown.length;
  return (
    <View className={`flex-row flex-wrap ${className}`}>
      {shown.map(tag => (
        <View
          key={tag}
          className="mb-1 mr-1.5 rounded-md border border-card-border bg-surface-muted px-2 py-0.5">
          <Text className="font-sans text-xs text-text-secondary">{tag}</Text>
        </View>
      ))}
      {hidden > 0 ? (
        <View className="mb-1 mr-1.5 rounded-md border border-card-border bg-surface-muted px-2 py-0.5">
          <Text className="font-sans text-xs text-text-secondary">
            +{hidden}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default TagChips;
