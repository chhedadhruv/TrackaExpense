import React, {useState} from 'react';
import {FlatList, Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Plus from 'lucide-react-native/icons/plus';
import Shapes from 'lucide-react-native/icons/shapes';
import {useUid} from '../src/data/hooks';
import {useCategoryData, useCategoryLists} from '../src/data/categories';
import {finishRename, savePrefs} from '../src/services/CategoryService';
import {reportError} from '../src/services/ErrorReporter';
import {ErrorState, LoadingState} from '../src/components/ScreenState';
import {useTheme} from '../src/theme';
import {snackbar} from '../src/utils/snackbarStore';
import {
  isLastVisible,
  moveValue,
  withHidden,
  type CategoryEntry,
  type CategoryType,
} from '../src/utils/customCategories';

const TYPES: readonly {value: CategoryType; label: string}[] = [
  {value: 'expense', label: 'Expense'},
  {value: 'income', label: 'Income'},
];

interface RowProps {
  entry: CategoryEntry;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onToggleHidden: () => void;
  onOpen: () => void;
}

const IconButton = ({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{disabled}}
    disabled={disabled}
    hitSlop={6}
    onPress={onPress}
    className={`ml-1 h-9 w-9 items-center justify-center rounded-full ${
      disabled ? 'opacity-30' : ''
    }`}>
    {children}
  </TouchableOpacity>
);

const CategoryRow = ({
  entry,
  first,
  last,
  busy,
  onMove,
  onToggleHidden,
  onOpen,
}: RowProps) => {
  const {colors} = useTheme();
  const Icon = entry.icon;
  const content = (
    <>
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
        <Icon
          size={20}
          color={entry.hidden ? colors.iconMuted : colors.primary}
        />
      </View>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={`font-sans-bold text-base ${
            entry.hidden ? 'text-text-muted' : 'text-text-strong'
          }`}>
          {entry.label}
        </Text>
        <Text className="font-sans text-xs text-text-secondary">
          {entry.renamingFrom
            ? 'Rename not finished'
            : entry.builtIn
            ? entry.hidden
              ? 'Built-in, hidden'
              : 'Built-in'
            : 'Yours'}
        </Text>
      </View>
    </>
  );
  return (
    <View className="mb-2 flex-row items-center rounded-2xl border border-card-border bg-surface px-3 py-2.5">
      {entry.builtIn ? (
        <View className="flex-1 flex-row items-center">{content}</View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Edit ${entry.label}`}
          onPress={onOpen}
          className="flex-1 flex-row items-center">
          {content}
          <ChevronRight size={18} color={colors.textPlaceholder} />
        </TouchableOpacity>
      )}
      <IconButton
        label={`Move ${entry.label} up`}
        disabled={busy || first}
        onPress={() => onMove(-1)}>
        <ChevronUp size={20} color={colors.textSecondary} />
      </IconButton>
      <IconButton
        label={`Move ${entry.label} down`}
        disabled={busy || last}
        onPress={() => onMove(1)}>
        <ChevronDown size={20} color={colors.textSecondary} />
      </IconButton>
      {entry.builtIn ? (
        <IconButton
          label={entry.hidden ? `Show ${entry.label}` : `Hide ${entry.label}`}
          disabled={busy}
          onPress={onToggleHidden}>
          {entry.hidden ? (
            <EyeOff size={20} color={colors.textSecondary} />
          ) : (
            <Eye size={20} color={colors.primary} />
          )}
        </IconButton>
      ) : (
        <View className="ml-1 h-9 w-9" />
      )}
    </View>
  );
};

/** Profile > Categories: add your own, hide built-in ones and choose the order of each list. */
const CategoriesScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const uid = useUid();
  const [type, setType] = useState<CategoryType>('expense');
  const data = useCategoryData();
  const {entries} = useCategoryLists(type);
  const [busy, setBusy] = useState(false);

  // Writes rewrite the preferences from what is shown, so they wait for the live listener.
  const locked = busy || !data.live;

  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      reportError(e as Error);
      snackbar.error(failure);
    } finally {
      setBusy(false);
    }
  };

  const move = (entry: CategoryEntry, delta: -1 | 1) =>
    run(
      () =>
        savePrefs(uid, {
          ...data.prefs,
          order: {
            ...data.prefs.order,
            [type]: moveValue(
              entries.map(e => e.value),
              entry.value,
              delta,
            ),
          },
        }),
      'Could not save the order. Try again.',
    );

  const toggleHidden = (entry: CategoryEntry) => {
    if (!entry.hidden && isLastVisible(entries)) {
      snackbar.info('Keep at least one category visible.');
      return;
    }
    run(
      () =>
        savePrefs(
          uid,
          withHidden(data.prefs, type, entry.value, !entry.hidden),
        ),
      'Could not save. Try again.',
    );
  };

  const unfinished = data.customs.filter(c => c.renamingFrom);
  const finish = () =>
    run(async () => {
      let moved = 0;
      for (const c of unfinished) {
        moved += await finishRename(uid, c);
      }
      snackbar.success(
        `Rename finished${moved > 0 ? `, ${moved} entries updated` : ''}`,
      );
    }, 'Could not finish the rename. Check your connection and try again.');

  if (data.loading) {
    return <LoadingState message="Loading your categories..." />;
  }
  if (data.failed && !data.live && data.customs.length === 0) {
    return (
      <ErrorState
        title="Could not load your categories"
        message="Check your connection and try again."
        onRetry={data.retry}
      />
    );
  }

  const header = (
    <View className="mb-3">
      <Text
        accessibilityRole="header"
        className="font-heading text-xl font-bold text-text-strong">
        Categories
      </Text>
      <Text className="mt-1 font-sans text-sm text-text-secondary">
        Add your own, hide the ones you never use and put the ones you use most
        on top. Hidden categories stay on your old entries.
      </Text>
      <View className="mt-4 flex-row rounded-full bg-surface-muted p-1">
        {TYPES.map(t => {
          const selected = t.value === type;
          return (
            <TouchableOpacity
              key={t.value}
              accessibilityRole="tab"
              accessibilityState={{selected}}
              onPress={() => setType(t.value)}
              className={`flex-1 items-center rounded-full py-2 ${
                selected ? 'bg-primary-fill' : ''
              }`}>
              <Text
                className={`font-sans-bold text-sm ${
                  selected ? 'text-on-primary' : 'text-text-secondary'
                }`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {unfinished.length > 0 ? (
        <View className="mt-3 rounded-xl bg-warning-soft p-3">
          <Text className="font-sans text-sm text-warning-text">
            A rename did not finish: some old entries still use the old name.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={locked}
            onPress={finish}
            className="mt-2 self-start">
            <Text className="font-sans-bold text-sm text-primary">
              Finish now
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={entries}
        keyExtractor={e => e.id ?? `builtin:${e.value}`}
        contentContainerClassName="p-4 pb-10"
        ListHeaderComponent={header}
        renderItem={({item, index}) => (
          <CategoryRow
            entry={item}
            first={index === 0}
            last={index === entries.length - 1}
            busy={locked}
            onMove={delta => move(item, delta)}
            onToggleHidden={() => toggleHidden(item)}
            onOpen={() =>
              router.navigate({
                pathname: '/profile/category',
                params: {id: item.id ?? '', type},
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Shapes size={32} color={colors.iconMuted} />
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() =>
              router.navigate({pathname: '/profile/category', params: {type}})
            }
            className="mt-2 flex-row items-center justify-center rounded-2xl border-[1.5px] border-dashed border-primary-fill py-3.5">
            <Plus size={20} color={colors.primary} />
            <Text className="ml-2 font-sans-bold text-base text-primary">
              Add {type} category
            </Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
};

export default CategoriesScreen;
