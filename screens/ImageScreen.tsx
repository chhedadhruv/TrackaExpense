import React, {useState} from 'react';
import {
  View,
  Text,
  ImageBackground,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {useTheme} from '../src/theme';

const ImageScreen = ({route}: {route: any}) => {
  const {colors} = useTheme();
  const {imageUrl} = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-background">
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
          <ImageBackground
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
    </SafeAreaView>
  );
};

export default ImageScreen;
