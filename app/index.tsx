import React, {useContext, useEffect, useState} from 'react';
import {Redirect} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AuthContext} from '../navigation/AuthProvider';

/**
 * The address "/" has no screen of its own: it sends a signed-in person to Home, a first-time
 * visitor to the onboarding and everyone else to the login screen.
 */
const Start = () => {
  const {user} = useContext(AuthContext);
  const [firstLaunch, setFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      return;
    }
    (async () => {
      try {
        const alreadyLaunched = await AsyncStorage.getItem('alreadyLaunched');
        if (alreadyLaunched === null) {
          await AsyncStorage.setItem('alreadyLaunched', 'true');
          setFirstLaunch(true);
        } else {
          setFirstLaunch(false);
        }
      } catch (_) {
        setFirstLaunch(false);
      }
    })();
  }, [user]);

  if (user) {
    return <Redirect href="/home" />;
  }
  if (firstLaunch === null) {
    return null;
  }
  return <Redirect href={firstLaunch ? '/onboarding' : '/login'} />;
};

export default Start;
