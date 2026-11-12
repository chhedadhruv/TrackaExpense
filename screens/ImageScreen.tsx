import React, {useState} from 'react';
import {View, Text, Image, ActivityIndicator} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {useTheme} from '../src/theme';

const ImageScreen = () => {
  const {colors} = useTheme();
  const {imageUrl} = useLocalSearchParams<{imageUrl: string}>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        {loading && !error && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            className="absolute left-1/2 top-1/2 -ml-[18px] -mt-[18px]"
          />
        )}
        {error ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-center font-sans text-lg text-expense-text">
              Failed to load image
            </Text>
          </View>
        ) : (
          // A plain Image: ImageBackground (deprecated) only adds a wrapper for children, and
          // this screen draws nothing on top of the picture.
          <Image
            source={{uri: imageUrl}}
            className="h-full w-full"
            resizeMode="contain"
            accessibilityLabel="Receipt image"
            onLoad={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
          />
        )}
      </View>
    </View>
  );
};

export default ImageScreen;
