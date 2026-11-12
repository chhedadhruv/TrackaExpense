import React, {type ReactNode} from 'react';
import {
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useTheme} from '../theme';

interface CardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Shadow depth; 0 is flat. Android draws it with `elevation`, iOS with a shadow. */
  elevation?: number;
  /** Makes the whole card tappable. */
  onPress?: () => void;
}

const shadowFor = (elevation: number, color: string): ViewStyle => {
  if (elevation <= 0) {
    return {};
  }
  return Platform.OS === 'android'
    ? {elevation}
    : {
        shadowColor: color,
        shadowOffset: {width: 0, height: elevation},
        shadowOpacity: 0.12,
        shadowRadius: elevation * 1.5,
      };
};

/**
 * A rounded surface that holds a block of content: the card background from the theme, radius 12
 * and an optional shadow. A screen's own `style` wins, so a card can set its own colour, margins
 * and radius. With `onPress` the whole card is a button.
 */
const Card = ({children, style, elevation = 1, onPress}: CardProps) => {
  const {colors} = useTheme();
  const base: StyleProp<ViewStyle> = [
    {backgroundColor: colors.surface, borderRadius: 12},
    shadowFor(elevation, colors.shadow),
    style,
  ];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={base}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
};

export default Card;
