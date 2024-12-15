import React, {useState} from 'react';
import {Text, TouchableOpacity, StyleSheet, View} from 'react-native';
import {windowHeight, windowWidth} from '../utils/Dimentions';

const FormButton = ({buttonTitle, style, textStyle, ...rest}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  return (
    <TouchableOpacity
      style={[styles.buttonContainer, isPressed && styles.pressed, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
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
    width: windowWidth * 0.9,
    height: windowHeight / 15,
    backgroundColor: '#677CD2',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'Lato-Regular',
  },
  pressed: {
    opacity: 0.7,
  },
});
