import React from 'react';
import {Switch} from 'react-native';
import {useTheme} from '../theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/** An on/off switch in the theme's colours. */
const Toggle = ({value, onValueChange, disabled}: ToggleProps) => {
  const {colors} = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{false: colors.border, true: colors.primaryFill}}
      thumbColor={colors.onPrimary}
      ios_backgroundColor={colors.border}
    />
  );
};

export default Toggle;
