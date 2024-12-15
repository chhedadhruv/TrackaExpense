import React, {useState} from 'react';
import {
  View,
  Text,
  ImageBackground,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

const ImageScreen = ({route}) => {
  const {imageUrl} = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleImageError = () => {
    setError(true);
    setLoading(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  return (
    <SafeAreaView style={{flex: 1}}>
      <View style={{flex: 1}}>
        {loading && !error && (
          <ActivityIndicator
            size="large"
            color="#677CD2"
            style={styles.loadingIndicator}
          />
        )}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load image</Text>
          </View>
        ) : (
          <ImageBackground
            source={{uri: imageUrl}}
            style={{width: '100%', height: '100%'}}
            onLoad={handleImageLoad}
            onError={handleImageError}></ImageBackground>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{translateX: -25}, {translateY: -25}],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#F64E4E',
    textAlign: 'center',
  },
});

export default ImageScreen;
