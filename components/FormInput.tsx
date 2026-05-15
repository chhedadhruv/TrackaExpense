import React from 'react';
import {View, TextInput, StyleSheet, TextInputProps, StyleProp, TextStyle} from 'react-native';
import {windowHeight} from '../utils/Dimentions';
import AntDesign from 'react-native-vector-icons/AntDesign';

interface FormInputProps extends TextInputProps {
  labelValue?: string;
  placeholderText?: string;
  iconType?: string;
  iconSize?: number;
  iconColor?: string;
  inputStyle?: StyleProp<TextStyle>;
}

const FormInput = ({
  labelValue,
  placeholderText,
  iconType,
  iconSize = 25,
  iconColor = '#666',
  inputStyle,
  ...rest
}: FormInputProps) => {
  return (
    <View style={styles.inputContainer}>
      {iconType && (
        <View style={styles.iconStyle}>
          <AntDesign name={iconType} size={iconSize} color={iconColor} />
        </View>
      )}
      <TextInput
        value={labelValue}
        style={[styles.input, inputStyle]}
        numberOfLines={1}
        placeholder={placeholderText}
        placeholderTextColor="#666"
        {...rest}
        accessibilityLabel={placeholderText}
        accessibilityHint={`Enter your ${placeholderText}`}
      />
    </View>
  );
};

export default FormInput;

const styles = StyleSheet.create({
  inputContainer: {
    marginTop: 5,
    marginBottom: 10,
    width: '100%',
    height: windowHeight / 15,
    borderColor: '#ccc',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  iconStyle: {
    padding: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightColor: '#ccc',
    borderRightWidth: 1,
    width: 50,
  },
  input: {
    padding: 10,
    flex: 1,
    fontSize: 16,
    fontFamily: 'Lato-Regular',
    color: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
