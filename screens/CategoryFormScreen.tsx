import React, {useEffect, useState} from 'react';
import {Alert, Text, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import Shapes from 'lucide-react-native/icons/shapes';
import Tag from 'lucide-react-native/icons/tag';
import FormButton from '../components/FormButton';
import CategoryIconGrid from '../src/components/CategoryIconGrid';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {ErrorState, LoadingState} from '../src/components/ScreenState';
import {
  FormCard,
  FormError,
  FormHeader,
  FormSection,
} from '../src/components/form/FormParts';
import TextField from '../src/components/form/TextField';
import {DEFAULT_CATEGORY_ICON} from '../src/constants/categoryIcons';
import {BUILT_IN_NAMES, useCategoryData} from '../src/data/categories';
import {useUid} from '../src/data/hooks';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {
  createCategory,
  deleteCategory,
  finishRename,
  renameCategory,
  setCategoryIcon,
} from '../src/services/CategoryService';
import {reportError} from '../src/services/ErrorReporter';
import {useTheme} from '../src/theme';
import {
  MAX_CATEGORY_NAME,
  MAX_CUSTOM_CATEGORIES,
  categoryNameError,
  cleanCategoryName,
  type CategoryType,
} from '../src/utils/customCategories';
import {snackbar} from '../src/utils/snackbarStore';

const entriesText = (n: number): string =>
  n === 1 ? '1 entry updated' : `${n} entries updated`;

/** Add a category, or rename, change the icon of or delete one of the person's own. */
const CategoryFormScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const uid = useUid();
  const params = useLocalSearchParams<{id?: string; type?: string}>();
  const editingId = typeof params.id === 'string' ? params.id : '';
  const editing = editingId !== '';
  const data = useCategoryData();
  const existing = editing
    ? data.customs.find(c => c.id === editingId)
    : undefined;
  const type: CategoryType =
    existing?.type ?? (params.type === 'income' ? 'income' : 'expense');

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [filled, setFilled] = useState(!editing);
  const [error, setError] = useState('');

  // An existing category fills the form once, so a listener update never overwrites typing.
  useEffect(() => {
    if (!filled && existing) {
      setName(existing.name);
      setIcon(existing.icon);
      setFilled(true);
    }
  }, [filled, existing]);

  const submit = async () => {
    const cleaned = cleanCategoryName(name);
    const renaming = existing !== undefined && cleaned !== existing.name;
    if (!existing || renaming) {
      const problem =
        !existing &&
        data.customs.filter(c => c.type === type).length >=
          MAX_CUSTOM_CATEGORIES
          ? `You can have at most ${MAX_CUSTOM_CATEGORIES} of your own categories of each kind.`
          : categoryNameError(
              cleaned,
              BUILT_IN_NAMES,
              data.customs,
              type,
              existing?.id ?? null,
            );
      if (problem) {
        setError(problem);
        return;
      }
    }
    try {
      if (!existing) {
        await createCategory(uid, {name: cleaned, type, icon});
        snackbar.success('Category added');
      } else {
        if (icon !== existing.icon) {
          await setCategoryIcon(uid, existing.id, icon);
        }
        if (renaming) {
          const moved = await renameCategory(
            uid,
            existing,
            cleaned,
            data.prefs,
          );
          snackbar.success(
            moved > 0 ? `Renamed, ${entriesText(moved)}` : 'Renamed',
          );
        } else {
          snackbar.success('Category saved');
        }
      }
      router.back();
    } catch (e) {
      reportError(e as Error);
      setError(
        renaming
          ? 'The rename did not finish. Your categories screen shows it; finish it from there when you are back online.'
          : 'Could not save the category. Check your connection and try again.',
      );
    }
  };
  const {run: handleSave, pending: saving} = useAsyncAction(submit);

  const finish = async () => {
    if (!existing) {
      return;
    }
    try {
      const moved = await finishRename(uid, existing);
      snackbar.success(`Rename finished, ${entriesText(moved)}`);
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Could not finish the rename. Try again.');
    }
  };
  const {run: handleFinish, pending: finishing} = useAsyncAction(finish);

  const deleteIt = async () => {
    if (!existing) {
      return;
    }
    try {
      await deleteCategory(uid, existing, data.prefs);
      snackbar.success('Category deleted');
      router.back();
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Could not delete the category. Try again.');
    }
  };
  const {run: handleDelete, pending: deleting} = useAsyncAction(deleteIt);

  const confirmDelete = () => {
    Alert.alert(
      'Delete category',
      'It will no longer be offered. Entries already filed under it keep the name.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: () => handleDelete()},
      ],
    );
  };

  if (editing && !filled) {
    if (data.live && !existing) {
      return (
        <ErrorState
          title="Category not found"
          message="It may have been deleted on another device."
          onRetry={() => router.back()}
        />
      );
    }
    return <LoadingState message="Loading the category..." />;
  }

  // Saving rewrites the preferences from what is shown, so it waits for the live listener.
  const busy = saving || deleting || finishing || !data.live;
  const pendingRename = existing?.renamingFrom ?? null;

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <FormHeader
          icon={Shapes}
          iconColor={colors.primary}
          title={editing ? 'Edit Category' : 'Add Category'}
          subtitle={
            type === 'expense' ? 'An expense category' : 'An income category'
          }
        />
        <FormCard>
          {error ? <FormError message={error} /> : null}
          {pendingRename ? (
            <View className="mb-4 rounded-xl bg-warning-soft p-3">
              <Text className="font-sans text-sm text-warning-text">
                Some entries still use the old name "{pendingRename}".
              </Text>
              <FormButton
                buttonTitle="Finish rename"
                onPress={handleFinish}
                loading={finishing}
                disabled={busy}
              />
            </View>
          ) : null}

          <TextField
            label="Name"
            icon={Tag}
            maxLength={MAX_CATEGORY_NAME}
            value={name}
            onChangeText={text => {
              setName(text);
              setError('');
            }}
            placeholder="For example, Pets"
            disabled={busy || pendingRename !== null}
          />
          {editing ? (
            <Text className="-mt-2 mb-4 font-sans text-xs text-text-secondary">
              Renaming also moves your past entries, recurring rules and budgets
              to the new name.
            </Text>
          ) : null}

          <FormSection label="Icon">
            <CategoryIconGrid value={icon} onChange={setIcon} disabled={busy} />
          </FormSection>

          <FormButton
            buttonTitle={editing ? 'Save Category' : 'Add Category'}
            onPress={handleSave}
            loading={saving}
            disabled={busy}
          />
          {editing ? (
            <FormButton
              buttonTitle="Delete Category"
              onPress={confirmDelete}
              loading={deleting}
              disabled={busy}
              style={{backgroundColor: colors.expense}}
            />
          ) : null}
        </FormCard>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default CategoryFormScreen;
