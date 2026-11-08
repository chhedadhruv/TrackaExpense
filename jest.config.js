module.exports = {
  preset: 'react-native',
  // firebase/tests uses the Node test runner against the emulator (yarn test:rules).
  testPathIgnorePatterns: [
    '/node_modules/',
    '/firebase/',
    '/android/',
    '/ios/',
  ],
};
