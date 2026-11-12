import React, {useMemo, useState} from 'react';
import {Text, View} from 'react-native';
import {BarGroup, CartesianChart, useChartPressState} from 'victory-native';
import {useAnimatedReaction} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import {useTheme} from '../../theme';
import {compactAxisLabel, niceAxisMax} from '../../utils/chartAxis';
import {toMajorNumber} from '../../utils/money';
import {
  bucketLabel,
  bucketTitle,
  type TrendBucket,
  type TrendInterval,
} from '../../utils/statistics';
import {useChartFont} from './useChartFont';

interface TrendChartProps {
  buckets: TrendBucket[];
  interval: TrendInterval;
  currencyCode: string;
  formatAmount: (amount: number) => string;
}

const Y_SECTIONS = 3;
const MAX_X_LABELS = 6;

/**
 * Income and expense side by side for each day, week or month of the range. Touch and drag over
 * the chart to read one bucket; the figures come from the same integer buckets as the cards.
 */
const TrendChart = ({
  buckets,
  interval,
  currencyCode,
  formatAmount,
}: TrendChartProps) => {
  const {colors} = useTheme();
  const font = useChartFont(11);
  const {state, isActive} = useChartPressState({
    x: 0,
    y: {income: 0, expense: 0},
  });
  const [pressed, setPressed] = useState(-1);

  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (current, previous) => {
      if (current !== previous) {
        scheduleOnRN(setPressed, current);
      }
    },
  );

  const data = useMemo(
    () =>
      buckets.map((b, index) => ({
        x: index,
        income: toMajorNumber(b.incomeMinor, currencyCode),
        expense: toMajorNumber(b.expenseMinor, currencyCode),
      })),
    [buckets, currencyCode],
  );

  const yMax = useMemo(
    () =>
      niceAxisMax(
        Math.max(0, ...data.map(d => Math.max(d.income, d.expense))),
        Y_SECTIONS,
      ),
    [data],
  );
  const yTicks = useMemo(
    () =>
      Array.from({length: Y_SECTIONS + 1}, (_, i) => (yMax / Y_SECTIONS) * i),
    [yMax],
  );
  const xTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(buckets.length / MAX_X_LABELS));
    return data.filter((_, i) => i % step === 0).map(d => d.x);
  }, [buckets.length, data]);

  const selected = isActive && pressed >= 0 ? buckets[pressed] : undefined;
  const readout = selected ?? buckets[buckets.length - 1];

  return (
    <View>
      <View className="mb-3 min-h-[44px]">
        <Text className="font-sans text-xs text-text-secondary">
          {selected
            ? bucketTitle(selected, interval)
            : 'Touch the chart for details'}
        </Text>
        {selected ? (
          <View className="mt-1 flex-row">
            <Text className="mr-4 font-sans-bold text-sm text-income">
              {formatAmount(toMajorNumber(selected.incomeMinor, currencyCode))}
            </Text>
            <Text className="font-sans-bold text-sm text-expense">
              {formatAmount(toMajorNumber(selected.expenseMinor, currencyCode))}
            </Text>
          </View>
        ) : (
          <Text className="mt-1 font-sans text-xs text-text-muted">
            Latest: {bucketTitle(readout, interval)}
          </Text>
        )}
      </View>
      <View
        className="h-[220px]"
        accessible
        accessibilityLabel="Income and expense chart">
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={['income', 'expense']}
          domain={{y: [0, yMax]}}
          domainPadding={{left: 24, right: 24, top: 8}}
          chartPressState={state}
          xAxis={{
            font,
            tickValues: xTicks,
            // Without this Victory thins the ticks to its default of five.
            tickCount: xTicks.length,
            labelColor: colors.textMuted,
            lineWidth: 0,
            formatXLabel: value => {
              const bucket = buckets[Math.round(Number(value))];
              return bucket ? bucketLabel(bucket, interval) : '';
            },
          }}
          yAxis={[
            {
              font,
              tickValues: yTicks,
              tickCount: yTicks.length,
              labelColor: colors.textMuted,
              lineColor: colors.divider,
              // No currency symbol: the chart font has no rupee glyph, and the cards above and
              // the readout already show the currency.
              formatYLabel: value => compactAxisLabel(Number(value), ''),
            },
          ]}>
          {({points, chartBounds}) => (
            <BarGroup
              chartBounds={chartBounds}
              betweenGroupPadding={0.28}
              withinGroupPadding={0.08}
              roundedCorners={{topLeft: 4, topRight: 4}}>
              <BarGroup.Bar points={points.income} color={colors.income} />
              <BarGroup.Bar points={points.expense} color={colors.expense} />
            </BarGroup>
          )}
        </CartesianChart>
      </View>
    </View>
  );
};

export default TrendChart;
