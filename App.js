import {NativeModules, PermissionsAndroid} from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import Providers from './navigation';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const App = () => {
  const [userData, setUserData] = useState(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  // const [widgetData, setWidgetData] = useState(null);

  const widgetData = {
    balance: userData ? userData.balance : 0,
    totalIncome: totalIncome,
    totalExpense: totalExpense,
  };

  const SharedStorage = NativeModules.SharedStorage;

  const getUser = async () => {
    const currentUser = await firestore()
      .collection('users')
      .doc(auth().currentUser.uid)
      .get()
      .then(documentSnapshot => {
        if (documentSnapshot.exists) {
          setUserData(documentSnapshot.data());
          console.log('User Data', documentSnapshot.data());
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    getUser();
  }, []);

  // useFocusEffect(
  //   useCallback(() => {
  //     getUser();
  //   }, []),
  // );

  const handleIncome = () => {
    if (userData && userData.transactions.length > 0) {
      let totalIncome = 0;

      userData.transactions.forEach(transaction => {
        if (transaction.type === 'income') {
          totalIncome += parseFloat(transaction.amount) || 0;
        }
      });

      setTotalIncome(totalIncome);
    } else {
      console.log('No transactions');
    }
  };

  const handleExpense = () => {
    if (userData && userData.transactions.length > 0) {
      let totalExpense = 0;

      userData.transactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          totalExpense += parseFloat(transaction.amount) || 0;
        }
      });

      setTotalExpense(totalExpense);
    } else {
      console.log('No transactions');
    }
  };

  useEffect(() => {
    SharedGroupPreferences.getItem('widgetData', 'group.com.moneymanager').then(
      value => {
        console.log('Widget Data', value);
        if (value) {
          SharedGroupPreferences.setItem(
            'widgetData',
            JSON.stringify(widgetData),
            'group.com.moneymanager',
          );
        }
      },
    );
  }
  , [widgetData]);

  useEffect(() => {
    handleIncome();
    handleExpense();
  }
  , [userData]);

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
