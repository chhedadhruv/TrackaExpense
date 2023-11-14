import {PermissionsAndroid} from 'react-native';
import React, { useEffect } from 'react';
import Providers from './navigation';

const App = () => {
  const requestPermissions = async () => {
    try {

      const fineLocationPermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const fineLocationGranted = await PermissionsAndroid.request(fineLocationPermission);

      const coarseLocationPermission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
      const coarseLocationGranted = await PermissionsAndroid.request(coarseLocationPermission);

      const readContactsPermission = PermissionsAndroid.PERMISSIONS.READ_CONTACTS;
      const readContactsGranted = await PermissionsAndroid.request(readContactsPermission);

      const sendSmsPermission = PermissionsAndroid.PERMISSIONS.SEND_SMS;
      const sendSmsGranted = await PermissionsAndroid.request(sendSmsPermission);

      const cammeraPermission = PermissionsAndroid.PERMISSIONS.CAMERA;
      const cammeraGranted = await PermissionsAndroid.request(cammeraPermission);

      if (
        fineLocationGranted === PermissionsAndroid.RESULTS.GRANTED &&
        coarseLocationGranted === PermissionsAndroid.RESULTS.GRANTED &&
        readContactsGranted === PermissionsAndroid.RESULTS.GRANTED &&
        sendSmsGranted === PermissionsAndroid.RESULTS.GRANTED &&
        cammeraGranted === PermissionsAndroid.RESULTS.GRANTED
      ) {
        console.log('Permissions granted');
      }
    } catch (err) {
      console.warn(err);
    }
  }

  useEffect(() => {
    requestPermissions();
  }, []);
  
  return <Providers />;
};

export default App;
