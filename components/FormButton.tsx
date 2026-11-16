import React, {useState} from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {windowHeight} from '../utils/Dimentions';
import {useTheme} from '../src/theme';

interface FormButtonProps {
  buttonTitle: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  /** Shows a spinner in place of the label, keeps the button size and ignores presses. */
  loading?: boolean;
  onPress?: () => void;
  [key: string]: any;
}

const BUTTON_HEIGHT = windowHeight / 15;

/** The primary full-width button. Colours come from the theme (primary-fill, on-primary). */
const FormButton = ({
  buttonTitle,
  style,
  textStyle,
  loading = false,
  disabled,
  ...rest
}: FormButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const {colors} = useTheme();

  return (
    <TouchableOpacity
      className={`mt-2.5 w-full items-center justify-center rounded-xl bg-primary-fill p-2.5 shadow-md ${
        isPressed ? 'scale-[0.98] opacity-80' : ''
      } ${loading ? 'opacity-70' : ''}`}
      style={[{height: BUTTON_HEIGHT}, style]}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      {...rest}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{disabled: !!(disabled || loading), busy: loading}}
      accessible>
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text
          className="font-sans-bold text-lg font-bold text-on-primary"
          style={textStyle}>
          {buttonTitle}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default FormButton;
