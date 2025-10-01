/**
 * @format
 */

import './gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee, {AndroidImportance} from '@notifee/react-native';

// Background handler must be registered at the root (separate JS context)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  // Don't show local notification - let OS handle server notifications
  // This prevents duplicates when server sends notification payload
});

AppRegistry.registerComponent(appName, () => App);
