import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthStack from './AuthStack'; // Screens for unauthenticated users
import AppStack from './AppStack'; // Screens for authenticated users
import { AuthContext } from './AuthProvider';
import auth from '@react-native-firebase/auth';

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
    <NavigationContainer ref={navigationRef}>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Routes;
