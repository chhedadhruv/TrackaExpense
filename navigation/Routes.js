import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthStack from './AuthStack'; // Screens for unauthenticated users
import AppStack from './AppStack'; // Screens for authenticated users
import { AuthContext } from './AuthProvider';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';

// Create a navigation reference to use outside of React components
export const navigationRef = React.createRef();

// Helper function to navigate from outside React components
export function navigate(name, params) {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
}

// Helper to get current route name
export function getCurrentRoute() {
  if (navigationRef.current) {
    return navigationRef.current.getCurrentRoute()?.name;
  }
  return null;
}

const linking = {
  prefixes: ['trackaexpense://'],
  config: {
    screens: {
      Home: {
        screens: {
          Home: 'home',
          AddIncome: 'income/add',
          AddExpense: 'expense/add',
        },
      },
      Statistic: {
        screens: {
          Statistic: 'statistic',
        },
      },
      Split: {
        screens: {
          Split: 'split',
          Invitations: 'split/invitations',
          SplitGroupDetail: 'split/group/:groupId',
        },
      },
      Savings: {
        screens: {
          Savings: 'savings',
        },
      },
    },
  },
  getInitialURL: async () => {
    const message = await messaging().getInitialNotification();
    if (message?.data?.url) return message.data.url;
    return null;
  },
  subscribe: listener => {
    const unsub = messaging().onNotificationOpenedApp(message => {
      if (message?.data?.url) listener(message.data.url);
    });
    return unsub;
  },
};

const Routes = () => {
  const { user, setUser } = useContext(AuthContext);
  const [initializing, setInitializing] = useState(true);

  // Handle changes in authentication state
  const onAuthStateChanged = (user) => {
    setUser(user); // Update the global user state
    if (initializing) setInitializing(false);
  };

  // Set up the authentication state listener
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return () => subscriber(); // Cleanup the listener on unmount
  }, []);

  // Show a loading indicator while initializing
  if (initializing) return null;

  // Render navigation stacks based on user authentication
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
    >
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Routes;
