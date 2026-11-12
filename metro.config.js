const {getDefaultConfig} = require('expo/metro-config');
const {withNativeWind} = require('nativewind/metro');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [path.resolve(__dirname)],
  resolver: {
    // Exclude only this project's server and Cloud Functions directories from the Metro bundler.
    // The patterns are anchored to the project root so packages with a "server" folder (for
    // example node_modules/@sentry/core/.../mcp-server) are still bundled.
    blockList: ['server', 'functions'].map(
      dir =>
        new RegExp(
          `^${path
            .resolve(__dirname, dir)
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`,
        ),
    ),
    extraNodeModules: {
      'node-fetch': path.resolve(__dirname, 'shims/node-fetch.js'),
    },
  },
};

// react-native-mmkv decides "am I in a test?" from process.env.JEST_WORKER_ID, which Metro's own
// transform workers set and Expo's transformer inlines into the bundle. Anything inside the
// package that asks for its isTest module gets the shim instead (see shims/mmkv-is-test.js).
const mmkvIsTestShim = path.resolve(__dirname, 'shims/mmkv-is-test.js');
const mmkvDir = `${path.sep}node_modules${path.sep}react-native-mmkv${path.sep}`;
const resolveRequest = (context, moduleName, platform) => {
  if (
    /(^|\/)isTest$/.test(moduleName) &&
    context.originModulePath.includes(mmkvDir)
  ) {
    return {type: 'sourceFile', filePath: mmkvIsTestShim};
  }
  return context.resolveRequest(context, moduleName, platform);
};

const defaults = getDefaultConfig(__dirname);

module.exports = withNativeWind(
  {
    ...defaults,
    watchFolders: [...(defaults.watchFolders || []), ...config.watchFolders],
    resolver: {
      ...defaults.resolver,
      blockList: [
        ...[].concat(defaults.resolver.blockList || []),
        ...config.resolver.blockList,
      ],
      extraNodeModules: {
        ...defaults.resolver.extraNodeModules,
        ...config.resolver.extraNodeModules,
      },
      resolveRequest,
    },
  },
  {input: './global.css'},
);
