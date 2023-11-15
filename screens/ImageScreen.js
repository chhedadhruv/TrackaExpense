import { View, Text, ImageBackground } from 'react-native'
import React from 'react'

const ImageScreen = ({route}) => {
    const { imageUrl } = route.params;
  return (
    <View style={{flex: 1}}>
      <ImageBackground source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} />
    </View>
  )
}

export default ImageScreen