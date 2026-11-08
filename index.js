import './gesture-handler';
import {registerRootComponent} from 'expo';
import App from './App';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

// Background handler must be registered at the root (separate JS context)
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  // Don't show local notification - let OS handle server notifications
  // This prevents duplicates when server sends notification payload
});

registerRootComponent(App);
