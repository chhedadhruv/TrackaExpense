import { Platform, Alert, Linking } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';
import { IOS_APP_STORE_ID } from '@env';

const IOS_STORE_URL = `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}`;
const IOS_STORE_URL_FALLBACK = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`;

class UpdateService {
  constructor() {
    this.inAppUpdates = new SpInAppUpdates(false);
    this.isChecking = false;
  }

  async checkForUpdate() {
    if (this.isChecking) return;
    this.isChecking = true;
    try {
      const result = await this.inAppUpdates.checkNeedsUpdate();
      if (result.shouldUpdate) {
        if (Platform.OS === 'android') {
          await this._startAndroidUpdate();
        } else if (Platform.OS === 'ios') {
          this._showIOSUpdateAlert();
        }
      }
    } catch (_) {
      // Silent: network errors, sideloaded builds, unpublished apps
    } finally {
      this.isChecking = false;
    }
  }

  async _startAndroidUpdate() {
    try {
      await this.inAppUpdates.startUpdate({ updateType: IAUUpdateKind.FLEXIBLE });
    } catch (_) {}
  }

  _showIOSUpdateAlert() {
    Alert.alert(
      'Update Available',
      'A new version of TrackaExpense is available on the App Store.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Update',
          onPress: () =>
            Linking.openURL(IOS_STORE_URL).catch(() =>
              Linking.openURL(IOS_STORE_URL_FALLBACK).catch(() => {}),
            ),
        },
      ],
      { cancelable: true },
    );
  }
}

export default new UpdateService();
