import './gesture-handler';
import {LogBox} from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

// Two notices that only debug builds show, both from Expo Router and neither about this app: it
// picks 'trackaexpense' out of the three URL schemes (the other two belong to sign-in and the
// package name), and loading it touches the deprecated ImageBackground export. The banner they
// raise covers the tab bar and swallows taps in the Maestro flows. Release builds never show
// LogBox. This runs before the router loads, which is why the entry below is a require().
LogBox.ignoreLogs([
  'Linking found multiple possible URI schemes',
  'ImageBackground is deprecated',
]);

// Background handler must be registered at the root (separate JS context)
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  // Don't show local notification - let OS handle server notifications
  // This prevents duplicates when server sends notification payload
});

// Expo Router registers the root component and builds the routes from the app/ folder.
require('expo-router/entry');
