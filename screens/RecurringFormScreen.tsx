import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Text, TouchableOpacity, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import Repeat from 'lucide-react-native/icons/repeat';
import Tag from 'lucide-react-native/icons/tag';
import AmountInput from '../src/components/AmountInput';
import CategorySelector from '../src/components/CategorySelector';
import DateInput from '../src/components/DateInput';
import Toggle from '../src/components/Toggle';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {
  FormCard,
  FormError,
  FormHeader,
  FormSection,
} from '../src/components/form/FormParts';
import TextField from '../src/components/form/TextField';
import CardField from '../src/components/form/CardField';
import {useCards} from '../src/hooks/useCards';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import FormButton from '../components/FormButton';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {
  useDeleteRecurring,
  useRecurring,
  useSaveRecurring,
} from '../src/hooks/useRecurring';
import {reportError} from '../src/services/ErrorReporter';
import {getConfig} from '../src/services/RemoteConfigService';
import {useTheme} from '../src/theme';
import {deviceTimeZone, todayInZone} from '../src/utils/budgets';
import {fromMinor} from '../src/utils/money';
import {
  buildRecurringWrite,
  FREQUENCIES,
  FREQUENCY_LABELS,
  RECURRING_TITLE_MAX,
  type RecurringDocument,
  type RecurringForm,
} from '../src/utils/recurring';
import {snackbar} from '../src/utils/snackbarStore';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_KEYWORD_MAP,
  EXPENSE_VALUES,
  INCOME_CATEGORIES,
  INCOME_KEYWORD_MAP,
  INCOME_VALUES,
} from '../utils/CategoryData';
import {getCurrencyByCode, useCurrency} from '../utils/CurrencyUtil';
import {
  useCategoryHistory,
  useCategorySuggestion,
} from '../src/hooks/useCategorySuggestion';
import {
  useTitleSuggestions,
  useTransactionTitleIndex,
} from '../src/hooks/useTitleSuggestions';
import TitleSuggestions from '../src/components/form/TitleSuggestions';

const categoriesFor = (type: 'expense' | 'income') =>
  type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

const valuesFor = (type: 'expense' | 'income') =>
  type === 'expense' ? EXPENSE_VALUES : INCOME_VALUES;

const formFrom = (rule: RecurringDocument): RecurringForm => ({
  title: rule.title,
  description: rule.description,
  type: rule.type,
  category: rule.category,
  frequency: rule.frequency,
  startDate: rule.startDate,
  hasEnd: rule.endDate !== null,
  endDate: rule.endDate ?? '',
  amountText: fromMinor(rule.amountMinor, rule.currency),
  currency: rule.currency,
  enabled: rule.enabled,
  cardId: rule.cardId,
});

/** A row of mutually exclusive pill buttons. */
const Choice = <T extends string>({
  options,
  value,
  label,
  disabled,
  onChange,
}: {
  options: readonly {value: T; label: string}[];
  value: T;
  label: (option: {value: T; label: string}) => string;
  disabled: boolean;
  onChange: (value: T) => void;
}) => (
  <View className="mb-2 flex-row flex-wrap">
    {options.map(option => {
      const selected = value === option.value;
      return (
        <TouchableOpacity
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{selected, disabled}}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          className={`mb-2 mr-3 rounded-full border px-4 py-2 ${
            selected
              ? 'border-primary bg-primary-fill'
              : 'border-border bg-surface'
          }`}>
          <Text
            className={`font-sans-bold text-sm ${
              selected ? 'text-on-primary' : 'text-text-strong'
            }`}>
            {label(option)}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const RecurringFormScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {id} = useLocalSearchParams<{id?: string}>();
  const {currency} = useCurrency();
  const rules = useRecurring();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const editing = typeof id === 'string' && id !== '';
  const cards = useCards().data;

  const [form, setForm] = useState<RecurringForm>({
    title: '',
    description: '',
    type: 'expense',
    // Starts empty: the title suggests one, or the person picks it.
    category: '',
    frequency: 'monthly',
    startDate: todayInZone(new Date(), deviceTimeZone()),
    hasEnd: false,
    endDate: '',
    amountText: '',
    currency: currency.code,
    enabled: true,
    // Always starts on Cash / UPI; a card is chosen on purpose.
    cardId: null,
  });
  const [filled, setFilled] = useState(!editing);
  const [error, setError] = useState('');

  // An existing rule fills the form once, so a list refresh never overwrites what is being typed.
  const existing = editing ? rules.data?.find(r => r.id === id) : undefined;
  useEffect(() => {
    if (!filled && existing) {
      setForm(formFrom(existing));
      setFilled(true);
    }
  }, [filled, existing]);

  const change = (patch: Partial<RecurringForm>) => {
    setForm(current => ({...current, ...patch}));
    if (error) {
      setError('');
    }
  };

  const categoryValues = valuesFor(form.type);
  const categoryHistory = useCategoryHistory(form.type, categoryValues);
  const setCategory = useCallback(
    (category: string) => setForm(current => ({...current, category})),
    [],
  );
  // A saved rule's category was the person's choice, so the guess never replaces it.
  const categorySuggestion = useCategorySuggestion({
    title: form.title,
    category: form.category,
    setCategory,
    allowed: categoryValues,
    keywordMap:
      form.type === 'expense' ? EXPENSE_KEYWORD_MAP : INCOME_KEYWORD_MAP,
    history: categoryHistory,
    startPickedByHand: editing,
  });
  const titleIndex = useTransactionTitleIndex(form.type, categoryValues);
  const setTitle = useCallback(
    (title: string) => setForm(current => ({...current, title})),
    [],
  );
  const titleSuggestions = useTitleSuggestions({
    index: titleIndex,
    title: form.title,
    setTitle,
    onCategory: categorySuggestion.applyGuess,
  });

  const submit = async () => {
    const zone = existing?.timeZone ?? deviceTimeZone();
    const result = buildRecurringWrite(
      form,
      zone,
      todayInZone(new Date(), zone),
      existing,
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    try {
      await save(editing ? (id as string) : null, result.data);
      snackbar.success(editing ? 'Rule updated' : 'Rule added');
      router.back();
    } catch (e) {
      reportError(e as Error);
      setError('Could not save the rule. Check your connection and try again.');
    }
  };
  const {run: handleSave, pending: saving} = useAsyncAction(submit);

  const deleteIt = async () => {
    try {
      await remove(id as string);
      snackbar.success('Rule deleted');
      router.back();
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Could not delete the rule. Try again.');
    }
  };
  const {run: handleDelete, pending: deleting} = useAsyncAction(deleteIt);

  const confirmDelete = () => {
    Alert.alert(
      'Delete rule',
      'No more transactions will be logged from it. Ones already logged stay.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            handleDelete();
          },
        },
      ],
    );
  };

  if (!getConfig().enable_recurring) {
    return (
      <EmptyState
        icon={Repeat}
        title="Recurring is not available yet"
        message="This feature is being rolled out. Check again soon."
        fill
      />
    );
  }
  if (editing && !filled) {
    if (rules.error || (!rules.loading && !existing)) {
      return (
        <ErrorState
          title="Could not load this rule"
          message="It may have been deleted, or the connection failed."
          onRetry={() => {
            rules.refetch();
          }}
        />
      );
    }
    return <LoadingState message="Loading the rule..." />;
  }

  const busy = saving || deleting;
  // Cards are offered only while the feature is on; a rule keeps showing its card even if the
  // card was archived since.
  const pickableCards = getConfig().enable_cards
    ? (cards ?? []).filter(c => !c.archived || c.id === form.cardId)
    : [];
  const symbol = getCurrencyByCode(form.currency).symbol;

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <FormHeader
          icon={Repeat}
          iconColor={colors.primary}
          title={editing ? 'Edit Rule' : 'Add Rule'}
          subtitle="Logged for you on every due date"
        />
        <FormCard>
          {error ? <FormError message={error} /> : null}

          <TextField
            label="Title"
            icon={Tag}
            maxLength={RECURRING_TITLE_MAX}
            value={form.title}
            onChangeText={title => change({title})}
            onFocus={titleSuggestions.onFocus}
            onBlur={titleSuggestions.onBlur}
            placeholder="For example, Rent"
            disabled={busy}>
            <TitleSuggestions
              suggestions={titleSuggestions.suggestions}
              onPick={titleSuggestions.pick}
              disabled={busy}
            />
          </TextField>

          <FormSection label="Amount">
            <AmountInput
              value={form.amountText}
              onChangeText={amountText => change({amountText})}
              currencySymbol={symbol}
              disabled={busy}
            />
          </FormSection>

          <FormSection label="Type">
            <Choice
              options={[
                {value: 'expense', label: 'Expense'},
                {value: 'income', label: 'Income'},
              ]}
              value={form.type}
              label={o => o.label}
              disabled={busy}
              onChange={type => {
                if (type === form.type) {
                  return;
                }
                // The other type has other categories: start empty and let the title suggest.
                categorySuggestion.reset();
                change({
                  type,
                  category: '',
                  // Only an expense can be paid with a card.
                  ...(type === 'income' ? {cardId: null} : {}),
                });
              }}
            />
          </FormSection>

          {form.type === 'expense' && pickableCards.length > 0 ? (
            <CardField
              cards={pickableCards}
              value={form.cardId}
              onChange={cardId => change({cardId})}
              disabled={busy}
            />
          ) : null}

          <FormSection label="Category">
            <CategorySelector
              categories={categoriesFor(form.type)}
              selectedCategory={form.category}
              onSelect={categorySuggestion.pickByHand}
              suggested={categorySuggestion.suggested}
              guessed={categorySuggestion.guessed}
              disabled={busy}
            />
          </FormSection>

          <FormSection label="Repeats">
            <Choice
              options={FREQUENCIES.map(f => ({
                value: f,
                label: FREQUENCY_LABELS[f],
              }))}
              value={form.frequency}
              label={o => o.label}
              disabled={busy}
              onChange={frequency => change({frequency})}
            />
          </FormSection>

          <FormSection label="Dates">
            <DateInput
              label="Starts"
              date={form.startDate}
              disabled={busy}
              onConfirm={startDate => change({startDate})}
            />
            <View className="mb-2 mt-2 flex-row items-center justify-between">
              <Text className="font-sans text-base text-text-strong">
                Stops on a date
              </Text>
              <Toggle
                value={form.hasEnd}
                disabled={busy}
                onValueChange={hasEnd => change({hasEnd})}
              />
            </View>
            {form.hasEnd ? (
              <DateInput
                label="Ends"
                date={form.endDate}
                disabled={busy}
                onConfirm={endDate => change({endDate})}
              />
            ) : null}
          </FormSection>

          <FormSection label="Active">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-sans text-base text-text-strong">
                Log transactions from this rule
              </Text>
              <Toggle
                value={form.enabled}
                disabled={busy}
                onValueChange={enabled => change({enabled})}
              />
            </View>
          </FormSection>

          <FormButton
            buttonTitle={editing ? 'Update Rule' : 'Add Rule'}
            onPress={handleSave}
            loading={saving}
            disabled={busy}
          />
          {editing ? (
            <FormButton
              buttonTitle="Delete Rule"
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

export default RecurringFormScreen;
