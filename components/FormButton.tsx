import React, {useState} from 'react';
import {
  Text,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {windowHeight} from '../utils/Dimentions';

interface FormButtonProps {
  buttonTitle: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  onPress?: () => void;
  [key: string]: any;
}

const BUTTON_HEIGHT = windowHeight / 15;

/** The primary full-width button. Colours come from the theme (primary-fill, on-primary). */
const FormButton = ({
  buttonTitle,
  style,
  textStyle,
  ...rest
}: FormButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableOpacity
      className={`mt-2.5 w-full items-center justify-center rounded-xl bg-primary-fill p-2.5 shadow-md ${
        isPressed ? 'scale-[0.98] opacity-80' : ''
      }`}
      style={[{height: BUTTON_HEIGHT}, style]}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      {...rest}
      accessibilityRole="button"
      accessible>
      <Text
        className="font-sans-bold text-lg font-bold text-on-primary"
        style={textStyle}>
        {buttonTitle}
      </Text>
    </TouchableOpacity>
  );
};

export default FormButton;
