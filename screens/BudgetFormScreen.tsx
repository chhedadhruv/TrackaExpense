import React, {useEffect, useState} from 'react';
import {Alert, Text, TouchableOpacity, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
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
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import FormButton from '../components/FormButton';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {
  useBudgets,
  useDeleteBudget,
  useSaveBudget,
} from '../src/hooks/useBudgets';
import {reportError} from '../src/services/ErrorReporter';
import {getConfig} from '../src/services/RemoteConfigService';
import {useTheme} from '../src/theme';
import {
  BUDGET_NAME_MAX,
  buildBudgetWrite,
  deviceTimeZone,
  THRESHOLDS,
  type BudgetDocument,
  type BudgetForm,
} from '../src/utils/budgets';
import {fromMinor} from '../src/utils/money';
import {snackbar} from '../src/utils/snackbarStore';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {useCategoryLists} from '../src/data/categories';
import {getCurrencyByCode, useCurrency} from '../utils/CurrencyUtil';

const ALL_ON = {50: true, 80: true, 100: true, 120: true} as const;

const formFrom = (budget: BudgetDocument): BudgetForm => ({
  name: budget.name,
  category: budget.category,
  period: budget.period,
  startDate: budget.startDate ?? '',
  endDate: budget.endDate ?? '',
  limitText: fromMinor(budget.limitMinor, budget.currency),
  currency: budget.currency,
  thresholds: {...budget.thresholds},
  enabled: budget.enabled,
});

const thresholdLabel = (t: number): string =>
  t < 100
    ? `At ${t} percent`
    : t === 100
    ? 'When the limit is reached'
    : `At ${t} percent (over the limit)`;

const BudgetFormScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {id} = useLocalSearchParams<{id?: string}>();
  const {currency} = useCurrency();
  const budgets = useBudgets();
  const save = useSaveBudget();
  const remove = useDeleteBudget();
  const editing = typeof id === 'string' && id !== '';

  const [form, setForm] = useState<BudgetForm>({
    name: '',
    category: null,
    period: 'monthly',
    startDate: '',
    endDate: '',
    limitText: '',
    currency: currency.code,
    thresholds: {...ALL_ON},
    enabled: true,
  });
  const [filled, setFilled] = useState(!editing);
  const [error, setError] = useState('');
  const expenseLists = useCategoryLists('expense');

  // An existing budget fills the form once, so later list refreshes never overwrite typing.
  const existing = editing ? budgets.data?.find(b => b.id === id) : undefined;
  useEffect(() => {
    if (!filled && existing) {
      setForm(formFrom(existing));
      setFilled(true);
    }
  }, [filled, existing]);

  const change = (patch: Partial<BudgetForm>) => {
    setForm(current => ({...current, ...patch}));
    if (error) {
      setError('');
    }
  };

  const submit = async () => {
    const result = buildBudgetWrite(
      form,
      existing?.timeZone ?? deviceTimeZone(),
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    try {
      await save(editing ? (id as string) : null, result.data);
      const budgetCategory = result.data.category ?? 'all';
      if (editing) {
        AnalyticsService.logBudgetEdited({category: budgetCategory});
      } else {
        AnalyticsService.logBudgetCreated({
          category: budgetCategory,
          period: result.data.period,
        });
      }
      snackbar.success(editing ? 'Budget updated' : 'Budget added');
      router.back();
    } catch (e) {
      reportError(e as Error);
      setError(
        'Could not save the budget. Check your connection and try again.',
      );
    }
  };
  const {run: handleSave, pending: saving} = useAsyncAction(submit);

  const confirmDelete = () => {
    Alert.alert('Delete budget', 'This budget will stop raising alerts.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          handleDelete();
        },
      },
    ]);
  };
  const deleteIt = async () => {
    try {
      await remove(id as string);
      AnalyticsService.logBudgetDeleted();
      snackbar.success('Budget deleted');
      router.back();
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Could not delete the budget. Try again.');
    }
  };
  const {run: handleDelete, pending: deleting} = useAsyncAction(deleteIt);

  if (!getConfig().enable_budgets) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="Budgets are not available yet"
        message="This feature is being rolled out. Check again soon."
        fill
      />
    );
  }
  if (editing && !filled) {
    if (budgets.error || (!budgets.loading && !existing)) {
      return (
        <ErrorState
          title="Could not load this budget"
          message="It may have been deleted, or the connection failed."
          onRetry={() => {
            budgets.refetch();
          }}
        />
      );
    }
    return <LoadingState message="Loading the budget..." />;
  }

  const busy = saving || deleting;
  const symbol = getCurrencyByCode(form.currency).symbol;

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <FormHeader
          icon={PiggyBank}
          iconColor={colors.primary}
          title={editing ? 'Edit Budget' : 'Add Budget'}
          subtitle="Set a limit and choose when to be alerted"
        />
        <FormCard>
          {error ? <FormError message={error} /> : null}

          <TextField
            label="Name"
            optional
            icon={Tag}
            maxLength={BUDGET_NAME_MAX}
            value={form.name}
            onChangeText={name => change({name})}
            placeholder="For example, Groceries"
            disabled={busy}
          />

          <FormSection label="Limit">
            <AmountInput
              value={form.limitText}
              onChangeText={limitText => change({limitText})}
              currencySymbol={symbol}
              disabled={busy}
              placeholder="Enter the limit"
            />
          </FormSection>

          <FormSection label="Spending it covers">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-sans text-base text-text-strong">
                All spending
              </Text>
              <Toggle
                value={form.category === null}
                disabled={busy}
                onValueChange={all =>
                  change({
                    category: all
                      ? null
                      : expenseLists.categories[0]?.value ?? 'Others',
                  })
                }
              />
            </View>
            {form.category !== null ? (
              <CategorySelector
                categories={expenseLists.categories}
                createType="expense"
                selectedCategory={form.category}
                onSelect={category => change({category})}
                disabled={busy}
              />
            ) : null}
          </FormSection>

          <FormSection label="Period">
            <View className="mb-2 flex-row">
              {(['monthly', 'custom'] as const).map(p => {
                const selected = form.period === p;
                return (
                  <TouchableOpacity
                    key={p}
                    accessibilityRole="radio"
                    accessibilityState={{selected, disabled: busy}}
                    disabled={busy}
                    onPress={() => change({period: p})}
                    className={`mr-3 rounded-full border px-4 py-2 ${
                      selected
                        ? 'border-primary bg-primary-fill'
                        : 'border-border bg-surface'
                    }`}>
                    <Text
                      className={`font-sans-bold text-sm ${
                        selected ? 'text-on-primary' : 'text-text-strong'
                      }`}>
                      {p === 'monthly' ? 'Every month' : 'Custom dates'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {form.period === 'custom' ? (
              <View>
                <DateInput
                  label="Starts"
                  date={form.startDate}
                  disabled={busy}
                  onConfirm={startDate => change({startDate})}
                />
                <DateInput
                  label="Ends"
                  date={form.endDate}
                  disabled={busy}
                  onConfirm={endDate => change({endDate})}
                />
              </View>
            ) : null}
          </FormSection>

          <FormSection label="Alerts">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-sans text-base text-text-strong">
                Send alerts
              </Text>
              <Toggle
                value={form.enabled}
                disabled={busy}
                onValueChange={enabled => change({enabled})}
              />
            </View>
            {THRESHOLDS.map(t => (
              <View
                key={t}
                className="mb-2 flex-row items-center justify-between">
                <Text
                  className={`font-sans text-sm ${
                    form.enabled ? 'text-text-strong' : 'text-text-placeholder'
                  }`}>
                  {thresholdLabel(t)}
                </Text>
                <Toggle
                  value={form.thresholds[t]}
                  disabled={busy || !form.enabled}
                  onValueChange={on =>
                    change({thresholds: {...form.thresholds, [t]: on}})
                  }
                />
              </View>
            ))}
          </FormSection>

          <FormButton
            buttonTitle={editing ? 'Update Budget' : 'Add Budget'}
            onPress={handleSave}
            loading={saving}
            disabled={busy}
          />
          {editing ? (
            <FormButton
              buttonTitle="Delete Budget"
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

export default BudgetFormScreen;
