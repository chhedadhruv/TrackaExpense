import {Platform, Alert, Linking} from 'react-native';
import SpInAppUpdates, {IAUUpdateKind} from 'sp-react-native-in-app-updates';
import {IOS_APP_STORE_ID} from '@env';

const IOS_STORE_URL = `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}`;
const IOS_STORE_URL_FALLBACK = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`;
const ANDROID_STORE_URL = 'market://details?id=com.trackaexpense';
const ANDROID_STORE_URL_FALLBACK =
  'https://play.google.com/store/apps/details?id=com.trackaexpense';

class UpdateService {
  private inAppUpdates: SpInAppUpdates;
  private isChecking: boolean;

  constructor() {
    this.inAppUpdates = new SpInAppUpdates(false);
    this.isChecking = false;
  }

  async checkForUpdate(): Promise<void> {
    if (this.isChecking) {
      return;
    }
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

  private async _startAndroidUpdate(): Promise<void> {
    try {
      await this.inAppUpdates.startUpdate({
        updateType: IAUUpdateKind.IMMEDIATE,
      });
    } catch (_) {}
  }

  /** Opens this app's page in the Play Store or App Store. */
  openStorePage(): void {
    if (Platform.OS === 'android') {
      Linking.openURL(ANDROID_STORE_URL).catch(() =>
        Linking.openURL(ANDROID_STORE_URL_FALLBACK).catch(() => {}),
      );
    } else {
      Linking.openURL(IOS_STORE_URL).catch(() =>
        Linking.openURL(IOS_STORE_URL_FALLBACK).catch(() => {}),
      );
    }
  }

  private _showIOSUpdateAlert(): void {
    Alert.alert(
      'Update Available',
      'A new version of TrackaExpense is available on the App Store.',
      [
        {text: 'Later', style: 'cancel'},
        {
          text: 'Update',
          onPress: () =>
            Linking.openURL(IOS_STORE_URL).catch(() =>
              Linking.openURL(IOS_STORE_URL_FALLBACK).catch(() => {}),
            ),
        },
      ],
      {cancelable: true},
    );
  }
}

export default new UpdateService();
