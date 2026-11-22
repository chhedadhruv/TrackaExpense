module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^lucide-react-native/icons/.+$': '<rootDir>/__mocks__/lucideIcon.js',
  },
  // firebase/tests uses the Node test runner against the emulator (yarn test:rules).
  testPathIgnorePatterns: [
    '/node_modules/',
    '/firebase/',
    '/functions/',
    '/android/',
    '/ios/',
  ],
};
