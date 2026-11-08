const {getDefaultConfig} = require('expo/metro-config');
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
    blockList: [
      // Exclude only this project's server directory from the Metro bundler. The pattern is
      // anchored to the project root so packages with a "server" folder (for example
      // node_modules/@sentry/core/.../mcp-server) are still bundled.
      new RegExp(
        `^${path
          .resolve(__dirname, 'server')
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`,
      ),
    ],
    extraNodeModules: {
      'node-fetch': path.resolve(__dirname, 'shims/node-fetch.js'),
    },
  },
};

const defaults = getDefaultConfig(__dirname);

module.exports = {
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
  },
};
