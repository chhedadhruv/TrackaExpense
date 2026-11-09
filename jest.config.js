module.exports = {
  preset: 'jest-expo',
  // firebase/tests uses the Node test runner against the emulator (yarn test:rules).
  testPathIgnorePatterns: [
    '/node_modules/',
    '/firebase/',
    '/functions/',
    '/android/',
    '/ios/',
  ],
};
