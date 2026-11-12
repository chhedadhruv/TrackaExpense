import React from 'react';
import {View} from 'react-native';
import Check from 'lucide-react-native/icons/check';
import {useTheme} from '../theme';

/**
 * A square tick box, drawn the same on Android and iOS. It only shows a state: put it inside the
 * pressable row (or wrap it) and let that handle the tap.
 */
const TickBox = ({selected}: {selected: boolean}) => {
  const {colors} = useTheme();
  return (
    <View
      accessibilityRole="checkbox"
      accessibilityState={{checked: selected}}
      className={`ml-1 h-6 w-6 items-center justify-center rounded border-2 ${
        selected
          ? 'border-primary-fill bg-primary-fill'
          : 'border-text-muted bg-surface'
      }`}>
      {selected ? <Check size={18} color={colors.onPrimary} /> : null}
    </View>
  );
};

export default TickBox;
