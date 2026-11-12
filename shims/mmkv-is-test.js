// Stands in for react-native-mmkv's own isTest() in the app bundle (see metro.config.js).
//
// The library switches to an in-memory mock whenever process.env.JEST_WORKER_ID is set. Expo's
// Metro transformer inlines process.env.<NAME> from the transform worker's environment, and
// Metro's workers are jest-workers, which set JEST_WORKER_ID. So the check came out true inside
// the app bundle and MMKV silently saved nothing (the query cache vanished on every restart).
// Jest does not use Metro, so tests still get the library's own isTest() and its mock.
exports.isTest = () => false;
