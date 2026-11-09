const fs = require('fs');
const path = require('path');
const {withDangerousMod} = require('expo/config-plugins');

// The small icon Android shows in the status bar and next to a notification. It has to be white on
// transparent. OneSignal looks for a drawable named ic_stat_onesignal_default and falls back to a
// bell when it is missing. The PNGs live in assets/notification-icon/<density>/ and are copied into
// the generated android/ project on every prebuild (android/ is never edited by hand).
const ICON_NAME = 'ic_stat_onesignal_default.png';
const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

module.exports = config =>
  withDangerousMod(config, [
    'android',
    cfg => {
      const root = cfg.modRequest.projectRoot;
      const resDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
      );
      for (const density of DENSITIES) {
        const source = path.join(
          root,
          'assets',
          'notification-icon',
          density,
          ICON_NAME,
        );
        if (!fs.existsSync(source)) {
          throw new Error(`Missing notification icon: ${source}`);
        }
        const targetDir = path.join(resDir, `drawable-${density}`);
        fs.mkdirSync(targetDir, {recursive: true});
        fs.copyFileSync(source, path.join(targetDir, ICON_NAME));
      }
      return cfg;
    },
  ]);
