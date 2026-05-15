import React, {useState} from 'react';
import {Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, TextStyle} from 'react-native';
import {windowHeight} from '../utils/Dimentions';
import {PRIMARY_COLOR} from '../src/constants/theme';

interface FormButtonProps {
  buttonTitle: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  onPress?: () => void;
  [key: string]: any;
}

const FormButton = ({buttonTitle, style, textStyle, ...rest}: FormButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.buttonContainer, isPressed && styles.pressed, style]}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      {...rest}
      accessibilityRole="button"
      accessible>
      <Text style={[styles.buttonText, textStyle]}>{buttonTitle}</Text>
    </TouchableOpacity>
  );
};

export default FormButton;

const styles = StyleSheet.create({
  buttonContainer: {
    marginTop: 10,
    width: '100%',
    height: windowHeight / 15,
    backgroundColor: PRIMARY_COLOR,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    elevation: 4,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'Lato-Bold',
  },
  pressed: {
    opacity: 0.8,
    transform: [{scale: 0.98}],
  },
});
