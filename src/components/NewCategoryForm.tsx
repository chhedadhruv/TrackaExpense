import React, {useState} from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useTheme} from '../theme';
import {useUid} from '../data/hooks';
import {builtInNamesFor, useCategoryData} from '../data/categories';
import * as AnalyticsService from '../services/AnalyticsService';
import {createCategory} from '../services/CategoryService';
import {reportError} from '../services/ErrorReporter';
import {DEFAULT_CATEGORY_ICON} from '../constants/categoryIcons';
import {
  MAX_CATEGORY_NAME,
  MAX_CUSTOM_CATEGORIES,
  categoryNameError,
  type CategoryType,
} from '../utils/customCategories';
import CategoryIconGrid from './CategoryIconGrid';

interface Props {
  type: CategoryType;
  /** Starts the name field with this text (what was searched for). */
  initialName?: string;
  /** Called with the new category's name once it is saved. */
  onCreated: (name: string) => void;
  onCancel: () => void;
}

/** A small form to add a category from inside the category picker. */
const NewCategoryForm = ({
  type,
  initialName = '',
  onCreated,
  onCancel,
}: Props) => {
  const {colors} = useTheme();
  const uid = useUid();
  const {customs} = useCategoryData();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const problem =
      customs.filter(c => c.type === type).length >= MAX_CUSTOM_CATEGORIES
        ? `You can have at most ${MAX_CUSTOM_CATEGORIES} of your own categories of each kind.`
        : categoryNameError(name, builtInNamesFor(type), customs, type);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const created = await createCategory(uid, {name, type, icon});
      AnalyticsService.logCustomCategoryCreated(type);
      onCreated(created);
    } catch (e) {
      reportError(e as Error);
      setError('Could not save the category. Check your connection.');
      setSaving(false);
    }
  };

  return (
    <View className="mb-2">
      <Text className="mb-2 font-sans-bold text-xs uppercase tracking-wide text-text-secondary">
        New {type} category
      </Text>
      <TextInput
        value={name}
        onChangeText={text => {
          setName(text);
          setError(null);
        }}
        placeholder="Name"
        placeholderTextColor={colors.textPlaceholder}
        selectionColor={colors.primary}
        maxLength={MAX_CATEGORY_NAME}
        autoFocus
        editable={!saving}
        accessibilityLabel="New category name"
        className="mb-3 h-12 rounded-xl border border-card-border bg-surface-muted px-3.5 font-sans text-base text-text-strong"
      />
      <CategoryIconGrid value={icon} onChange={setIcon} disabled={saving} />
      {error ? (
        <Text className="mt-2 font-sans text-sm text-expense-text">
          {error}
        </Text>
      ) : null}
      <View className="mt-3 flex-row justify-end gap-2.5">
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onCancel}
          disabled={saving}
          className="rounded-full border border-card-border px-4 py-2.5">
          <Text className="font-sans-bold text-sm text-text-secondary">
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={save}
          disabled={saving}
          className={`rounded-full bg-primary-fill px-4 py-2.5 ${
            saving ? 'opacity-50' : ''
          }`}>
          <Text className="font-sans-bold text-sm text-on-primary">
            {saving ? 'Saving...' : 'Add category'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default NewCategoryForm;
