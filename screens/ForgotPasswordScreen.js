import { View, Text, StyleSheet } from 'react-native'
import React, { useState, useContext } from 'react'
import FormInput from '../components/FormInput'
import FormButton from '../components/FormButton'
import { AuthContext } from '../navigation/AuthProvider'

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState()
    const [errorMessage, setErrorMessage] = useState(null)
    const { forgotPassword } = useContext(AuthContext)

    const isValidEmail = (email) => {
        const re = /\S+@\S+\.\S+/
        return re.test(email)
    }

    const handleForgotPassword = () => {
        if (!email) {
            setErrorMessage('Please enter an email address')
        }
        else if (!isValidEmail(email)) {
            setErrorMessage('Please enter a valid email address')
        }
        else {
            forgotPassword(email)
            navigation.navigate('Login')
        }
    }

  return (
    <View style={styles.container}>
        <Text style={styles.text}>Forgot Password?</Text>
        <Text style={styles.text}>Enter your email address below to reset your password</Text>
        {errorMessage && <Text style={{color: 'red', marginBottom: 10}}>{errorMessage}</Text>}
        <FormInput
            labelValue={email}
            onChangeText={(userEmail) => setEmail(userEmail)}
            placeholderText='Email'
            iconType='user'
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
        />
        <FormButton
            buttonTitle='Reset Password'
            onPress={() => handleForgotPassword()}
        />
    </View>
  )
}

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    text: {
        fontSize: 20,
        color: '#333333',
    },
})
