const {AndroidConfig, withAndroidManifest} = require('expo/config-plugins');

// An installed app asks the EAS Update server for updates of one channel, named in a request
// header that is stored in the Android manifest. `eas build` writes that header from the build
// profile's `channel` (eas.json) after prebuild. The local release build
// (scripts/local-release.sh) does not go through `eas build`, so the first local build (1.5.0,
// versionCode 26111220) shipped with no channel and can never receive an update.
//
// When RELEASE_UPDATE_CHANNEL is set (only scripts/local-release.sh sets it), this writes the
// same manifest entry `eas build` would. When it is not set nothing changes, so EAS builds keep
// their own channel. The channel is read from the environment, not from app.json, so the Expo
// config, and with it the fingerprint runtime version, is the same with and without it.
const REQUEST_HEADERS_KEY =
  'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY';

module.exports = config =>
  withAndroidManifest(config, cfg => {
    const channel = (process.env.RELEASE_UPDATE_CHANNEL || '').trim();
    if (!channel) {
      return cfg;
    }
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults,
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      REQUEST_HEADERS_KEY,
      JSON.stringify({'expo-channel-name': channel}),
    );
    return cfg;
  });
