import { View, Text, Image, StyleSheet } from 'react-native'
import React from 'react'

const SavingScreen = () => {
  return (
    <View style={styles.container}>
      <Image source={require('../assets/savings.png')} style={styles.image} />
      <Text style={styles.text}>Savings Coming Soon!</Text>
    </View>
  )
}

export default SavingScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  image: {
    width: 350,
    height: 250
  },
  text: {
    fontSize: 20,
    fontFamily: 'Kufam-SemiBoldItalic',
    color: '#333',
    marginTop: 20
  }
})
