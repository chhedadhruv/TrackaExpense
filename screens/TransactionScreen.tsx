import React, {useState, useMemo} from 'react';
import {useRouter} from 'expo-router';
import {View, Text, FlatList, ScrollView, TouchableOpacity} from 'react-native';
import SearchField from '../src/components/SearchField';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import Calendar1 from 'lucide-react-native/icons/calendar-1';
import CalendarArrowDown from 'lucide-react-native/icons/calendar-arrow-down';
import CalendarArrowUp from 'lucide-react-native/icons/calendar-arrow-up';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CalendarRange from 'lucide-react-native/icons/calendar-range';
import Download from 'lucide-react-native/icons/download';
import List from 'lucide-react-native/icons/list';
import moment from 'moment';
import DatePickerModal from '../src/components/DatePickerModal';
import {reportError} from '../src/services/ErrorReporter';
import {shareCsv} from '../src/services/ExportService';
import {buildTransactionsCsv, exportFileName} from '../src/utils/exportCsv';
import {useCurrency} from '../utils/CurrencyUtil';
import {majorOf} from '../src/utils/amounts';
import {useCategoryIcon} from '../src/data/categories';
import {useTheme} from '../src/theme';
import {getConfig} from '../src/services/RemoteConfigService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import type {TransactionDocument} from '../src/types';
import type {AppIcon} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import {useTransactions} from '../src/data/hooks';
import TagChips from '../src/components/TagChips';
import {collectTags, tagKey} from '../src/utils/tags';
import {
  CASH_FILTER,
  filterTransactions,
  type PeriodFilter,
} from '../src/utils/transactionFilter';
import {useCards} from '../src/hooks/useCards';
import {cardIdOf} from '../src/utils/cards';

type FilterType = PeriodFilter;

const FILTERS: FilterType[] = ['all', '7days', '30days', 'custom'];

const FILTER_ICONS: Record<FilterType, AppIcon> = {
  all: List,
  '7days': Calendar1,
  '30days': CalendarDays,
  custom: CalendarRange,
};

const FilterGlyph = ({
  filter,
  size,
  color,
}: {
  filter: FilterType;
  size: number;
  color: string;
}) => {
  const Icon = FILTER_ICONS[filter];
  return <Icon size={size} color={color} />;
};

const CategoryGlyph = ({
  icon: Icon,
  size,
  color,
}: {
  icon: AppIcon;
  size: number;
  color: string;
}) => <Icon size={size} color={color} />;

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  '7days': 'Last 7 Days',
  '30days': 'Last 30 Days',
  custom: 'Custom Range',
};

// A stable empty list, so the memo below does not recompute while nothing has loaded.
const NO_TRANSACTIONS: TransactionDocument[] = [];

const TransactionScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {currency, formatAmount} = useCurrency();
  const iconFor = useCategoryIcon();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  // "Paid with" filter: a card id, CASH_FILTER (no card) or null (any). Cards are only loaded and
  // offered while the feature is on and the person has one.
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const cardsEnabled = getConfig().enable_cards;
  const cardList = useCards().data;
  const cardNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const c of cardList ?? []) {
      names[c.id] = c.last4 ? `${c.name} ${c.last4}` : c.name;
    }
    return names;
  }, [cardList]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  // The newest transactions from the shared cache, which live listeners keep current: a delete or
  // edit made on the detail screen is here when you come back, with no reload.
  const {data, loading, error, retry} = useTransactions();
  const transactions = useMemo(
    () =>
      (data ?? NO_TRANSACTIONS).slice(
        0,
        getConfig().max_transactions_displayed,
      ),
    [data],
  );

  // Tags on the loaded transactions, most used first, so the tag filter only offers tags that
  // would return rows.
  const availableTags = useMemo(
    () => collectTags(transactions),
    [transactions],
  );
  // A reload can drop the chosen tag (its last transaction was edited or deleted); then the
  // filter lapses instead of leaving an empty list with no chip to switch it off.
  const activeTag =
    selectedTag &&
    availableTags.some(t => tagKey(t.tag) === tagKey(selectedTag))
      ? selectedTag
      : null;

  // The chosen card lapses when the feature is off or the card is gone, like the tag above.
  const activeCard =
    cardsEnabled &&
    selectedCard !== null &&
    (selectedCard === CASH_FILTER || selectedCard in cardNames)
      ? selectedCard
      : null;

  // One derived list: the period, the search text, the tag and the card all apply together.
  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, {
        period: filter,
        customStart: customStartDate,
        customEnd: customEndDate,
        query: searchQuery,
        tag: activeTag,
        card: activeCard,
      }),
    [
      transactions,
      filter,
      customStartDate,
      customEndDate,
      searchQuery,
      activeTag,
      activeCard,
    ],
  );

  // The export covers everything the current period, search and tag filters match, not just the
  // newest rows the list shows (the list is capped by `max_transactions_displayed`).
  const downloadCSV = async () => {
    const toExport = filterTransactions(data ?? NO_TRANSACTIONS, {
      period: filter,
      customStart: customStartDate,
      customEnd: customEndDate,
      query: searchQuery,
      tag: activeTag,
      card: activeCard,
    });
    if (toExport.length === 0) {
      snackbar.info('No transactions to export');
      return;
    }
    try {
      await shareCsv(
        exportFileName('transactions'),
        buildTransactionsCsv(toExport, currency.code, cardNames),
        'Export Transactions',
      );
    } catch (exportError) {
      reportError(exportError);
      snackbar.error('Failed to export transactions. Please try again.');
    }
  };

  if (loading) {
    return <LoadingState message="Loading transactions..." />;
  }

  // A failed load must not read as "No transactions found": show the error state instead.
  if (error) {
    return <ErrorState title="Could not load transactions" onRetry={retry} />;
  }

  const noResults = filteredTransactions.length === 0;

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-divider bg-surface px-5 py-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text
              accessibilityRole="header"
              className="mb-1 font-heading text-2xl font-bold text-text-strong">
              All Transactions
            </Text>
            <Text className="font-sans text-sm text-text-secondary">
              {filteredTransactions.length} transaction
              {filteredTransactions.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center rounded-[10px] bg-primary-soft px-3 py-2"
            accessibilityRole="button"
            accessibilityLabel="Download transactions as CSV"
            accessibilityState={{disabled: noResults}}
            onPress={downloadCSV}
            disabled={noResults}>
            <Download
              size={20}
              color={noResults ? colors.textPlaceholder : colors.primary}
            />
            <Text
              className={`ml-1.5 font-sans-bold text-sm ${
                noResults ? 'text-text-placeholder' : 'text-primary'
              }`}>
              Download CSV
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        data={filteredTransactions}
        keyExtractor={(transaction, index) => transaction.id ?? String(index)}
        initialNumToRender={12}
        windowSize={7}
        renderItem={({item: transaction}) => (
          <View className="px-5">
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.navigate(`/transaction/${transaction.id}`)}
              className="mb-3 flex-row items-center justify-between rounded-2xl border border-card-border bg-surface p-4 ios:shadow-md">
              <View className="flex-1 flex-row items-center">
                <View className="mr-3 h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-primary-soft">
                  <CategoryGlyph
                    icon={iconFor(transaction.category, transaction.type)}
                    size={25}
                    color={colors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong"
                    numberOfLines={1}>
                    {transaction.title}
                  </Text>
                  <Text className="mb-1 font-sans text-[13px] text-text-secondary">
                    {moment((transaction.createdAt as any).toDate()).format(
                      'MMM D, YYYY',
                    )}
                  </Text>
                  {transaction.category ? (
                    <View className="self-start rounded-md bg-primary-soft px-2 py-0.5">
                      <Text className="font-sans-bold text-xs text-primary">
                        {transaction.category}
                      </Text>
                    </View>
                  ) : null}
                  {cardIdOf(transaction) !== null ? (
                    <Text className="mt-1 font-sans text-xs text-text-secondary">
                      Paid with{' '}
                      {cardNames[cardIdOf(transaction) as string] ?? 'a card'}
                    </Text>
                  ) : null}
                  <TagChips tags={transaction.tags} max={3} className="mt-1" />
                </View>
              </View>
              <Text
                className={`ml-2 font-sans-bold text-base font-bold ${
                  transaction.type === 'income' ? 'text-income' : 'text-expense'
                }`}>
                {transaction.type === 'income' ? '+ ' : '- '}
                {formatAmount(majorOf(transaction, currency.code))}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={ReceiptText}
            title="No transactions found"
            message={
              searchQuery
                ? 'Try adjusting your search terms'
                : 'Transactions will appear here once you add them'
            }
          />
        }
        ListFooterComponent={<View className="h-[30px]" />}
        ListHeaderComponent={
          <>
            <View className="px-5 pt-5">
              <SearchField
                placeholder="Search by title, amount, category or tag..."
                onChangeText={setSearchQuery}
                value={searchQuery}
              />
            </View>

            <View className="px-5 pt-5">
              <Text className="mb-2.5 font-sans-bold text-base font-semibold text-text-strong">
                Filter by period
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {FILTERS.map(f => {
                  const active = filter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      accessibilityRole="button"
                      accessibilityState={{selected: active}}
                      onPress={() => {
                        setFilter(f);
                        AnalyticsService.logTransactionFilterChanged(f);
                      }}
                      className={`mr-2.5 flex-row items-center rounded-full border px-3.5 py-2 ${
                        active
                          ? 'border-primary-fill bg-primary-fill'
                          : 'border-card-border bg-surface'
                      }`}>
                      <FilterGlyph
                        filter={f}
                        size={16}
                        color={active ? colors.onPrimary : colors.primary}
                      />
                      <Text
                        className={`ml-1.5 font-sans-bold text-[13px] font-semibold ${
                          active ? 'text-on-primary' : 'text-primary'
                        }`}>
                        {FILTER_LABELS[f]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {cardsEnabled && Object.keys(cardNames).length > 0 && (
              <View className="px-5 pt-5">
                <Text className="mb-2.5 font-sans-bold text-base font-semibold text-text-strong">
                  Filter by payment method
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {[
                    {id: CASH_FILTER, label: 'Cash / UPI'},
                    ...Object.entries(cardNames).map(([id, label]) => ({
                      id,
                      label,
                    })),
                  ].map(option => {
                    const active = activeCard === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Paid with ${option.label}`}
                        accessibilityState={{selected: active}}
                        onPress={() =>
                          setSelectedCard(active ? null : option.id)
                        }
                        className={`mr-2.5 rounded-full border px-3.5 py-2 ${
                          active
                            ? 'border-primary-fill bg-primary-fill'
                            : 'border-card-border bg-surface'
                        }`}>
                        <Text
                          className={`font-sans-bold text-[13px] font-semibold ${
                            active ? 'text-on-primary' : 'text-primary'
                          }`}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {availableTags.length > 0 && (
              <View className="px-5 pt-5">
                <Text className="mb-2.5 font-sans-bold text-base font-semibold text-text-strong">
                  Filter by tag
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {availableTags.map(({tag, count}) => {
                    const active =
                      activeTag !== null && tagKey(activeTag) === tagKey(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        accessibilityRole="button"
                        accessibilityLabel={`Tag ${tag}, ${count} ${
                          count === 1 ? 'transaction' : 'transactions'
                        }`}
                        accessibilityState={{selected: active}}
                        onPress={() => {
                          setSelectedTag(active ? null : tag);
                          AnalyticsService.logTransactionFilterChanged('tag');
                        }}
                        className={`mr-2.5 flex-row items-center rounded-full border px-3.5 py-2 ${
                          active
                            ? 'border-primary-fill bg-primary-fill'
                            : 'border-card-border bg-surface'
                        }`}>
                        <Text
                          className={`font-sans-bold text-[13px] font-semibold ${
                            active ? 'text-on-primary' : 'text-primary'
                          }`}>
                          {tag}
                        </Text>
                        <Text
                          className={`ml-1.5 font-sans text-xs ${
                            active ? 'text-on-primary' : 'text-text-secondary'
                          }`}>
                          {count}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {filter === 'custom' && (
              <View className="mx-5 mt-5 rounded-2xl border border-card-border bg-surface p-5">
                <Text className="mb-[15px] font-sans-bold text-base font-semibold text-text-strong">
                  Select Date Range
                </Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    className="flex-1 rounded-xl border border-card-border bg-surface-muted p-3"
                    accessibilityRole="button"
                    onPress={() => setStartDatePickerVisible(true)}>
                    <View className="flex-row items-center">
                      <CalendarArrowUp size={20} color={colors.primary} />
                      <Text className="ml-2 font-sans text-sm text-text">
                        {customStartDate
                          ? moment(customStartDate).format('MMM DD, YYYY')
                          : 'Start Date'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View className="px-2.5">
                    <Text className="font-sans text-sm text-text-secondary">
                      to
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="flex-1 rounded-xl border border-card-border bg-surface-muted p-3"
                    accessibilityRole="button"
                    onPress={() => setEndDatePickerVisible(true)}>
                    <View className="flex-row items-center">
                      <CalendarArrowDown size={20} color={colors.primary} />
                      <Text className="ml-2 font-sans text-sm text-text">
                        {customEndDate
                          ? moment(customEndDate).format('MMM DD, YYYY')
                          : 'End Date'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <DatePickerModal
                  visible={startDatePickerVisible}
                  onDismiss={() => setStartDatePickerVisible(false)}
                  date={customStartDate ?? undefined}
                  onConfirm={({date}) => setCustomStartDate(date)}
                  label="Select start date"
                />
                <DatePickerModal
                  visible={endDatePickerVisible}
                  onDismiss={() => setEndDatePickerVisible(false)}
                  date={customEndDate ?? undefined}
                  onConfirm={({date}) => setCustomEndDate(date)}
                  label="Select end date"
                />
              </View>
            )}

            <View className="h-5" />
          </>
        }
      />
    </View>
  );
};

export default TransactionScreen;
