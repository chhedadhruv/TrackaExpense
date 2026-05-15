import {Platform, PermissionsAndroid, Alert} from 'react-native';

export const requestStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const androidVersion = Platform.Version as number;
      if (androidVersion >= 33) return true;

      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
      if (hasPermission) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission Required',
          message:
            'TrackaExpense needs access to your device storage to save CSV files with your transaction data.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        },
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
      if (granted === PermissionsAndroid.RESULTS.DENIED) {
        Alert.alert(
          'Permission Denied',
          'Storage permission is required to save CSV files. You can enable it in your device settings.',
          [{text: 'Cancel', style: 'cancel'}, {text: 'Settings', onPress: () => {}}],
        );
      }
      return false;
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  }
  return true;
};

export const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (hasPermission) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'TrackaExpense needs access to your camera to take photos of receipts.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Camera permission request error:', err);
      return false;
    }
  }
  return true;
};
