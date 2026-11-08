import * as ImagePicker from 'expo-image-picker';
import {Alert, Linking} from 'react-native';

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.8,
  base64: false,
};

const firstUri = (result: ImagePicker.ImagePickerResult): string | null =>
  result.canceled ? null : result.assets[0]?.uri ?? null;

/** Opens the camera and returns the photo URI, or null if cancelled or denied. */
export const pickImageFromCamera = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Camera permission needed',
      'Allow camera access in Settings to capture receipt photos.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: () => Linking.openSettings()},
      ],
    );
    return null;
  }
  return firstUri(await ImagePicker.launchCameraAsync(OPTIONS));
};

/** Opens the photo library and returns the chosen image URI, or null if cancelled. */
export const pickImageFromLibrary = async (): Promise<string | null> =>
  firstUri(await ImagePicker.launchImageLibraryAsync(OPTIONS));
