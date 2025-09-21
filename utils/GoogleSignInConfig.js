import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_HOSTED_DOMAIN,
  GOOGLE_OFFLINE_ACCESS,
  GOOGLE_FORCE_CODE_FOR_REFRESH_TOKEN,
  GOOGLE_ACCOUNT_NAME,
  GOOGLE_PROFILE_IMAGE_SIZE,
  GOOGLE_OPENID_REALM,
  GOOGLE_SERVICE_PLIST_PATH,
} from '@env';

// Google Sign-In Configuration
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID, // Web Client ID from Google Cloud Console
    offlineAccess: GOOGLE_OFFLINE_ACCESS === 'true', // if you want to access Google API on behalf of the user FROM YOUR SERVER
    hostedDomain: GOOGLE_HOSTED_DOMAIN || '', // specifies a hosted domain restriction
    forceCodeForRefreshToken: GOOGLE_FORCE_CODE_FOR_REFRESH_TOKEN === 'true', // [Android] related to `serverAuthCode`
    accountName: GOOGLE_ACCOUNT_NAME || '', // [Android] specifies an account name on the device that should be used
    iosClientId: GOOGLE_IOS_CLIENT_ID || '', // [iOS] if you want to specify the client ID of type iOS (otherwise, it is taken from GoogleService-Info.plist)
    googleServicePlistPath: GOOGLE_SERVICE_PLIST_PATH || '', // [iOS] if you renamed your GoogleService-Info file, new name here
    openIdRealm: GOOGLE_OPENID_REALM || '', // [iOS] The OpenID2 realm of the home web server
    profileImageSize: parseInt(GOOGLE_PROFILE_IMAGE_SIZE) || 120, // [iOS] The desired height (and width) of the profile image. Defaults to 120px
    scopes: [
      // what APIs you want to access on behalf of the user, default is email and profile
      // Add additional scopes here if needed
    ],
  });
};

// Helper function to check if user has previous sign-in
export const hasPreviousSignIn = () => {
  return GoogleSignin.hasPreviousSignIn();
};

// Helper function to get current user
export const getCurrentUser = () => {
  return GoogleSignin.getCurrentUser();
};

// Helper function to sign out
export const signOut = async () => {
  try {
    await GoogleSignin.signOut();
    return true;
  } catch (error) {
    console.error('Google Sign-Out Error:', error);
    return false;
  }
};

// Helper function to revoke access
export const revokeAccess = async () => {
  try {
    await GoogleSignin.revokeAccess();
    return true;
  } catch (error) {
    console.error('Google Revoke Access Error:', error);
    return false;
  }
};

// Helper function to get tokens
export const getTokens = async () => {
  try {
    const tokens = await GoogleSignin.getTokens();
    return tokens;
  } catch (error) {
    console.error('Google Get Tokens Error:', error);
    return null;
  }
};

// Helper function to clear cached access token
export const clearCachedAccessToken = async (accessToken) => {
  try {
    await GoogleSignin.clearCachedAccessToken(accessToken);
    return true;
  } catch (error) {
    console.error('Google Clear Cached Token Error:', error);
    return false;
  }
};
