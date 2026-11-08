const {withAppBuildGradle} = require('expo/config-plugins');

// Signs local release builds with the upload key described by android/keystore.properties
// (gitignored). EAS Build supplies its own credentials and replaces this signing config,
// so the file being absent is fine there. Without the file the release build falls back to
// the debug key, which Play rejects, so it can never be shipped by accident.
const LOADER = `
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;

const RELEASE_SIGNING = `        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['MYAPP_UPLOAD_STORE_FILE'])
                storePassword keystoreProperties['MYAPP_UPLOAD_STORE_PASSWORD']
                keyAlias keystoreProperties['MYAPP_UPLOAD_KEY_ALIAS']
                keyPassword keystoreProperties['MYAPP_UPLOAD_KEY_PASSWORD']
            }
        }
`;

module.exports = config =>
  withAppBuildGradle(config, cfg => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('MYAPP_UPLOAD_STORE_FILE')) {
      return cfg;
    }

    // 1. Load keystore.properties before the android block.
    gradle = gradle.replace(/\nandroid \{/, `${LOADER}\nandroid {`);

    // 2. Add a release signing config after the debug one.
    gradle = gradle.replace(
      /(signingConfigs \{\n\s+debug \{[\s\S]*?\n\s+\}\n)/,
      `$1${RELEASE_SIGNING}`,
    );

    // 3. Use it for the release build type when the file exists.
    gradle = gradle.replace(
      /(release \{\n\s+\/\/ Caution![\s\S]*?\n\s+)signingConfig signingConfigs\.debug/,
      '$1signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
