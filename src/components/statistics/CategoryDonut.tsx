import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Pie, PolarChart} from 'victory-native';
import {useTheme} from '../../theme';
import type {CategorySlice} from '../../utils/statistics';

/**
 * Slice colours. Data colours, the same in both themes; each is mid-tone so it reads on the light
 * card and on the charcoal one. "Others" is always grey.
 */
export const SLICE_PALETTE = [
  '#677CD2',
  '#E98852',
  '#25B07F',
  '#F6C84E',
  '#9B59B6',
  '#2E86C1',
];
const OTHERS_COLOR = '#8A93A6';

const fill = StyleSheet.create({flex: {flex: 1}});

export const sliceColor = (slice: CategorySlice, index: number): string =>
  slice.isOthers ? OTHERS_COLOR : SLICE_PALETTE[index % SLICE_PALETTE.length];

interface CategoryDonutProps {
  slices: CategorySlice[];
  centerTitle: string;
  centerValue: string;
}

const CategoryDonut = ({
  slices,
  centerTitle,
  centerValue,
}: CategoryDonutProps) => {
  const {colors} = useTheme();
  const data = useMemo(
    () =>
      slices.map((slice, index) => ({
        label: slice.category,
        value: slice.minor,
        color: sliceColor(slice, index),
      })),
    [slices],
  );

  return (
    <View
      className="h-[200px]"
      accessible
      accessibilityLabel={`${centerTitle} ${centerValue}`}>
      <PolarChart
        data={data}
        colorKey="color"
        valueKey="value"
        labelKey="label"
        containerStyle={fill.flex}
        canvasStyle={fill.flex}>
        <Pie.Chart innerRadius="68%">
          {() => (
            <Pie.Slice>
              {/* The gap between slices would draw a seam through a single full ring. */}
              {slices.length > 1 ? (
                <Pie.SliceAngularInset
                  angularInset={{
                    angularStrokeWidth: 3,
                    angularStrokeColor: colors.surface,
                  }}
                />
              ) : null}
            </Pie.Slice>
          )}
        </Pie.Chart>
      </PolarChart>
      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center">
        <Text className="font-sans text-xs text-text-secondary">
          {centerTitle}
        </Text>
        <Text className="mt-0.5 font-sans-bold text-lg text-text-strong">
          {centerValue}
        </Text>
      </View>
    </View>
  );
};

export default CategoryDonut;
