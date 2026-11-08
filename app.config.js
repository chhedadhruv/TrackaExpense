const fs = require('fs');
const path = require('path');

// Extends app.json. The R8 rules live in a real .pro file so they stay readable.
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

  return {...config, plugins};
};
