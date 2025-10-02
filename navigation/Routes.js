import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthStack from './AuthStack'; // Screens for unauthenticated users
import AppStack from './AppStack'; // Screens for authenticated users
import { AuthContext } from './AuthProvider';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';

// Create a navigation reference to use outside of React components
export const navigationRef = React.createRef();

// Store pending notification to handle after navigation is ready
let pendingNotification = null;

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

// Function to set pending notification (called from NotificationService)
export function setPendingNotification(data) {
  pendingNotification = data;
}

const Routes = () => {
  const { user, setUser } = useContext(AuthContext);
  const [initializing, setInitializing] = useState(true);
  const [isNavigationReady, setIsNavigationReady] = useState(false);

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

  // Handle pending notification when navigation is ready
  useEffect(() => {
    if (isNavigationReady && user && pendingNotification) {
      // Import the notification handler
      import('../services/NotificationService').then((module) => {
        const NotificationService = module.default;
        // Give navigation a bit more time to fully mount
        setTimeout(() => {
          NotificationService.handleNotificationTap(pendingNotification);
          pendingNotification = null; // Clear after handling
        }, 500);
      });
    }
  }, [isNavigationReady, user]);

  // Handle navigation ready callback
  const onNavigationReady = () => {
    setIsNavigationReady(true);
  };

  // Show a loading indicator while initializing
  if (initializing) return null;

  // Render navigation stacks based on user authentication
  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={onNavigationReady}
    >
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Routes;
