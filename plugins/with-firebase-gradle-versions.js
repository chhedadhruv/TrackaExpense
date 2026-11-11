const {withProjectBuildGradle} = require('expo/config-plugins');

// The React Native Firebase config plugin pins old Firebase Gradle plugins that use Android
// Gradle Plugin APIs removed in AGP 9 (the Transform API). Use releases that support AGP 9.
const VERSIONS = {
  'com.google.firebase:perf-plugin': '2.0.2',
};

module.exports = config =>
  withProjectBuildGradle(config, cfg => {
    let gradle = cfg.modResults.contents;
    for (const [artifact, version] of Object.entries(VERSIONS)) {
      gradle = gradle.replace(
        new RegExp(`(['"]${artifact}):[0-9.]+(['"])`),
        `$1:${version}$2`,
      );
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
