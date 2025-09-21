import { Platform, PermissionsAndroid, Alert } from 'react-native';

export const requestStoragePermission = async () => {
  if (Platform.OS === 'android') {
    try {
      // For Android 13+ (API 33+), we don't need WRITE_EXTERNAL_STORAGE permission
      // as we can write to app-specific directories
      const androidVersion = Platform.Version;
      
      if (androidVersion >= 33) {
        // Android 13+ - no permission needed for app-specific storage
        return true;
      }

      // For Android 12 and below, check WRITE_EXTERNAL_STORAGE permission
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );

      if (hasPermission) {
        return true;
      }

      // Request permission for older Android versions
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission Required',
          message: 'TrackaExpense needs access to your device storage to save CSV files with your transaction data.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else if (granted === PermissionsAndroid.RESULTS.DENIED) {
        Alert.alert(
          'Permission Denied',
          'Storage permission is required to save CSV files. You can enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => {
              // This would typically open app settings
              console.log('Open settings');
            }}
          ]
        );
        return false;
      } else {
        return false;
      }
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  }
  return true; // iOS doesn't need this permission
};

export const requestCameraPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );

      if (hasPermission) {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'TrackaExpense needs access to your camera to take photos of receipts.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Camera permission request error:', err);
      return false;
    }
  }
  return true;
};

export const checkAllPermissions = async () => {
  const permissions = {
    storage: await requestStoragePermission(),
    camera: await requestCameraPermission(),
  };
  
  return permissions;
};
