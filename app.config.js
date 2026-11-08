const fs = require('fs');
const path = require('path');

// Extends app.json.
// - The R8 rules live in a real .pro file so they stay readable.
// - On EAS the Firebase config files are not in git. EAS provides them as file variables
//   (GOOGLE_SERVICES_JSON and GOOGLE_SERVICE_INFO_PLIST hold the file paths); locally the
//   files sit at the repo root.
module.exports = ({config}) => {
  const rules = fs.readFileSync(
    path.join(__dirname, 'config', 'android-proguard-rules.pro'),
    'utf8',
  );

  const plugins = (config.plugins || []).map(plugin => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
      const options = plugin[1] || {};
      return [
        'expo-build-properties',
        {
          ...options,
          android: {...options.android, extraProguardRules: rules},
        },
      ];
    }
    return plugin;
  });

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
    },
    ios: {
      ...config.ios,
      googleServicesFile:
        process.env.GOOGLE_SERVICE_INFO_PLIST || config.ios?.googleServicesFile,
    },
    plugins,
  };
};
