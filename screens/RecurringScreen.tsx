import React from 'react';
import {FlatList, Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import Plus from 'lucide-react-native/icons/plus';
import Repeat from 'lucide-react-native/icons/repeat';
import {useRecurring} from '../src/hooks/useRecurring';
import {getConfig} from '../src/services/RemoteConfigService';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import {useTheme} from '../src/theme';
import {FREQUENCY_LABELS, type RecurringDocument} from '../src/utils/recurring';
import {toMajorNumber} from '../src/utils/money';
import {formatCurrency} from '../utils/CurrencyUtil';
import {formatDisplayDate} from '../src/utils/formatters';

const statusText = (rule: RecurringDocument): string => {
  if (rule.finished) {
    return 'Ended';
  }
  if (!rule.enabled) {
    return 'Paused';
  }
  return `Next: ${formatDisplayDate(rule.nextDueDate)}`;
};

const RuleCard = ({
  rule,
  onPress,
}: {
  rule: RecurringDocument;
  onPress: () => void;
}) => {
  const {colors} = useTheme();
  const amount = formatCurrency(
    toMajorNumber(rule.amountMinor, rule.currency),
    rule.currency,
  );
  const inactive = rule.finished || !rule.enabled;
  const sign = rule.type === 'expense' ? '-' : '+';
  const label = `${rule.title}, ${rule.type} of ${amount}, ${
    FREQUENCY_LABELS[rule.frequency]
  }, ${statusText(rule)}`;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={onPress}
      className="mb-3 rounded-2xl border border-card-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text
          numberOfLines={1}
          className="mr-3 flex-1 font-sans-bold text-base font-bold text-text-strong">
          {rule.title}
        </Text>
        <Text
          className="font-sans-bold text-base font-bold"
          style={{
            color: rule.type === 'expense' ? colors.expense : colors.income,
          }}>
          {sign} {amount}
        </Text>
      </View>
      <Text className="mt-1 font-sans text-xs text-text-secondary">
        {FREQUENCY_LABELS[rule.frequency]}, {rule.category}
      </Text>
      <Text
        className={`mt-2 font-sans text-sm ${
          inactive ? 'text-text-placeholder' : 'text-text-strong'
        }`}>
        {statusText(rule)}
      </Text>
    </TouchableOpacity>
  );
};

const RecurringScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const rules = useRecurring();
  const enabled = getConfig().enable_recurring;

  if (!enabled) {
    return (
      <EmptyState
        fill
        icon={Repeat}
        title="Recurring is not available yet"
        message="This feature is being rolled out. Check again soon."
      />
    );
  }
  if (rules.loading) {
    return <LoadingState message="Loading your recurring rules..." />;
  }
  if (rules.error) {
    return (
      <ErrorState
        title="Could not load your recurring rules"
        message="Check your connection and try again."
        onRetry={() => {
          rules.refetch();
        }}
      />
    );
  }

  const header = (
    <View className="mb-4">
      <Text
        accessibilityRole="header"
        className="font-heading text-[28px] font-bold text-text-strong">
        Recurring
      </Text>
      <Text className="mt-1 font-sans text-base text-text-secondary">
        Add rent, subscriptions or salary once and they are logged for you.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Add recurring rule"
        activeOpacity={0.8}
        onPress={() => router.navigate('/profile/recurring-rule')}
        className="mt-4 flex-row items-center justify-center rounded-xl bg-primary-fill py-3">
        <Plus size={20} color={colors.onPrimary} />
        <Text className="ml-2 font-sans-bold text-base font-bold text-on-primary">
          Add recurring rule
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="p-5 pb-10"
      data={rules.data ?? []}
      keyExtractor={rule => rule.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          icon={Repeat}
          title="No recurring rules yet"
          message="Add a rule and its transactions appear on their own."
        />
      }
      renderItem={({item}) => (
        <RuleCard
          rule={item}
          onPress={() =>
            router.navigate({
              pathname: '/profile/recurring-rule',
              params: {id: item.id},
            })
          }
        />
      )}
      onRefresh={() => {
        rules.refetch();
      }}
      refreshing={false}
    />
  );
};

export default RecurringScreen;
