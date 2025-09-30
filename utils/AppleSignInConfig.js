import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';

// Apple Sign-In Configuration
export const configureAppleSignIn = () => {
  // Apple Sign-In is only available on iOS
  if (Platform.OS !== 'ios') {
    return false;
  }

  // Check if Apple Sign-In is available on this device
  return appleAuth.isSupported;
};

// Helper function to perform Apple Sign-In
export const performAppleSignIn = async () => {
  try {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    if (!appleAuth.isSupported) {
      throw new Error('Apple Sign-In is not supported on this device');
    }

    // Start the sign-in request - let Apple handle nonce generation
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });

    // Check if we have the required tokens
    if (!appleAuthRequestResponse.identityToken) {
      throw new Error('No identity token received from Apple Sign-In');
    }

    if (!appleAuthRequestResponse.nonce) {
      throw new Error('No nonce received from Apple Sign-In');
    }

    // If we have valid tokens, proceed with sign-in
    if (appleAuthRequestResponse.identityToken && appleAuthRequestResponse.nonce) {
      return {
        success: true,
        user: appleAuthRequestResponse.user,
        email: appleAuthRequestResponse.email,
        fullName: appleAuthRequestResponse.fullName,
        identityToken: appleAuthRequestResponse.identityToken,
        nonce: appleAuthRequestResponse.nonce,
      };
    } else {
      throw new Error('No valid tokens received from Apple Sign-In');
    }
  } catch (error) {
    // Provide user-friendly error messages
    let userFriendlyMessage = error.message;
    
    if (error.message.includes('error 1000')) {
      userFriendlyMessage = 'Apple Sign-In failed. Please ensure you are signed into iCloud and try again.';
    } else if (error.message.includes('cancelled')) {
      userFriendlyMessage = 'Apple Sign-In was cancelled.';
    } else if (error.message.includes('not supported')) {
      userFriendlyMessage = 'Apple Sign-In is not available on this device.';
    } else if (error.message.includes('revoked')) {
      userFriendlyMessage = 'Apple ID authorization has been revoked. Please sign in again.';
    }

    return {
      success: false,
      error: userFriendlyMessage,
    };
  }
};
