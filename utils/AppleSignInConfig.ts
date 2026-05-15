import {appleAuth} from '@invertase/react-native-apple-authentication';
import {Platform} from 'react-native';

interface AppleSignInSuccess {
  success: true;
  user: string | undefined;
  email: string | null;
  fullName: {givenName?: string | null; familyName?: string | null} | null;
  identityToken: string;
  nonce: string;
}

interface AppleSignInFailure {
  success: false;
  error: string;
}

export type AppleSignInResult = AppleSignInSuccess | AppleSignInFailure;

export const configureAppleSignIn = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  return appleAuth.isSupported;
};

export const performAppleSignIn = async (): Promise<AppleSignInResult> => {
  try {
    if (Platform.OS !== 'ios') throw new Error('Apple Sign-In is only available on iOS');
    if (!appleAuth.isSupported) throw new Error('Apple Sign-In is not supported on this device');

    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });

    if (!response.identityToken) throw new Error('No identity token received from Apple Sign-In');
    if (!response.nonce) throw new Error('No nonce received from Apple Sign-In');

    return {
      success: true,
      user: response.user,
      email: response.email,
      fullName: response.fullName,
      identityToken: response.identityToken,
      nonce: response.nonce,
    };
  } catch (error) {
    const message = (error as Error).message ?? '';
    let userFriendlyMessage = message;

    if (message.includes('error 1000')) {
      userFriendlyMessage =
        'Apple Sign-In failed. Please ensure you are signed into iCloud and try again.';
    } else if (message.includes('cancelled')) {
      userFriendlyMessage = 'Apple Sign-In was cancelled.';
    } else if (message.includes('not supported')) {
      userFriendlyMessage = 'Apple Sign-In is not available on this device.';
    } else if (message.includes('revoked')) {
      userFriendlyMessage = 'Apple ID authorization has been revoked. Please sign in again.';
    }

    return {success: false, error: userFriendlyMessage};
  }
};
