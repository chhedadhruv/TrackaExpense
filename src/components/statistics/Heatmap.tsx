import React, {useState} from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {useTheme} from '../../theme';
import {toMajorNumber} from '../../utils/money';
import {
  shortDayLabel,
  type HeatCell,
  type Heatmap as HeatmapData,
} from '../../utils/statistics';

interface HeatmapProps {
  data: HeatmapData;
  color: string;
  currencyCode: string;
  formatAmount: (amount: number) => string;
  /** "Spent" or "Earned", used in the readout. */
  verb: string;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LEVEL_OPACITY = [0, 0.28, 0.5, 0.75, 1];
const LABEL_WIDTH = 18;
const GAP = 4;
const MAX_CELL = 26;

/** Square for one day: blank outside the range, a faint tile for no activity, else the colour. */
const cellStyle = (
  size: number,
  day: HeatCell,
  color: string,
  emptyColor: string,
  selectedBorder: string | null,
): ViewStyle => ({
  width: size,
  height: size,
  marginBottom: GAP,
  borderRadius: 5,
  backgroundColor: !day.inRange
    ? 'transparent'
    : day.level === 0
    ? emptyColor
    : color,
  opacity: day.level === 0 ? 1 : LEVEL_OPACITY[day.level],
  borderWidth: selectedBorder ? 2 : 0,
  borderColor: selectedBorder ?? 'transparent',
});

/**
 * Weeks as columns, Monday to Sunday as rows, one square per day. The darker the square, the more
 * that day compared with the busiest day shown. Tap a square to read it.
 */
const Heatmap = ({
  data,
  color,
  currencyCode,
  formatAmount,
  verb,
}: HeatmapProps) => {
  const {colors} = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const weekCount = data.weeks.length;
  const available = width - LABEL_WIDTH - GAP;
  const cell =
    weekCount > 0 && available > 0
      ? Math.min(MAX_CELL, Math.floor(available / weekCount) - GAP)
      : 0;

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const chosen = selected
    ? data.weeks.flat().find(c => c.day === selected)
    : undefined;

  return (
    <View onLayout={onLayout}>
      <View className="min-h-[20px]">
        <Text className="font-sans text-xs text-text-secondary">
          {chosen
            ? `${shortDayLabel(chosen.day)}: ${
                chosen.minor > 0
                  ? `${verb} ${formatAmount(
                      toMajorNumber(chosen.minor, currencyCode),
                    )}`
                  : `Nothing ${verb.toLowerCase()}`
              }`
            : 'Tap a day for details'}
        </Text>
      </View>
      {cell > 0 ? (
        <View className="mt-2 flex-row">
          <View style={{width: LABEL_WIDTH + GAP}}>
            {WEEKDAYS.map((label, i) => (
              <View
                key={i}
                style={{height: cell, marginBottom: GAP}}
                className="justify-center">
                <Text className="font-sans text-[10px] text-text-muted">
                  {i % 2 === 0 ? label : ''}
                </Text>
              </View>
            ))}
          </View>
          {data.weeks.map(week => (
            <View key={week[0].day} style={{marginRight: GAP}}>
              {week.map(day => (
                <Pressable
                  key={day.day}
                  disabled={!day.inRange}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortDayLabel(
                    day.day,
                  )}, ${formatAmount(toMajorNumber(day.minor, currencyCode))}`}
                  onPress={() => setSelected(day.day)}
                  style={cellStyle(
                    cell,
                    day,
                    color,
                    colors.border,
                    selected === day.day ? colors.textStrong : null,
                  )}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default Heatmap;
