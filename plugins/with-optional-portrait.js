const {withAndroidManifest} = require('expo/config-plugins');

// The app locks MainActivity to portrait (app.json "orientation"). Android then implies a hard
// requirement for the android.hardware.screen.portrait feature, and Google Play hides the app
// from devices without it (tablets, desktop, XR). Declaring the feature as not required keeps
// the portrait lock while restoring availability.
const FEATURE = 'android.hardware.screen.portrait';

module.exports = config =>
  withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    const existing = features.find(item => item.$['android:name'] === FEATURE);
    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      features.push({
        $: {'android:name': FEATURE, 'android:required': 'false'},
      });
    }
    manifest['uses-feature'] = features;
    return cfg;
  });
