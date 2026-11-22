import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {CATEGORY_ICONS} from '../constants/categoryIcons';
import {useTheme} from '../theme';

interface Props {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

/** The icons a custom category can use, as a grid of round buttons. */
const CategoryIconGrid = ({value, onChange, disabled = false}: Props) => {
  const {colors} = useTheme();
  return (
    <View className="flex-row flex-wrap gap-2">
      {CATEGORY_ICONS.map(({key, icon: Icon}) => {
        const selected = key === value;
        return (
          <TouchableOpacity
            key={key}
            accessibilityRole="radio"
            accessibilityState={{selected, disabled}}
            accessibilityLabel={`Icon ${key}`}
            disabled={disabled}
            onPress={() => onChange(key)}
            className={`h-11 w-11 items-center justify-center rounded-full border ${
              selected
                ? 'border-primary-fill bg-primary-fill'
                : 'border-card-border bg-surface'
            }`}>
            <Icon
              size={20}
              color={selected ? colors.onPrimary : colors.primary}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default CategoryIconGrid;
