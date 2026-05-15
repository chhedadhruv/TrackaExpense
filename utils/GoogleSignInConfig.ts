import {GoogleSignin} from '@react-native-google-signin/google-signin';
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

export const configureGoogleSignIn = (): void => {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: GOOGLE_OFFLINE_ACCESS === 'true',
    hostedDomain: GOOGLE_HOSTED_DOMAIN || '',
    forceCodeForRefreshToken: GOOGLE_FORCE_CODE_FOR_REFRESH_TOKEN === 'true',
    accountName: GOOGLE_ACCOUNT_NAME || '',
    iosClientId: GOOGLE_IOS_CLIENT_ID || '',
    googleServicePlistPath: GOOGLE_SERVICE_PLIST_PATH || '',
    openIdRealm: GOOGLE_OPENID_REALM || '',
    profileImageSize: parseInt(GOOGLE_PROFILE_IMAGE_SIZE, 10) || 120,
    scopes: ['email', 'profile'],
  });
};

export const hasPreviousSignIn = (): boolean => GoogleSignin.hasPreviousSignIn();

export const getCurrentUser = () => GoogleSignin.getCurrentUser();

export const signOut = async (): Promise<boolean> => {
  try {
    await GoogleSignin.signOut();
    return true;
  } catch (error) {
    console.error('Google Sign-Out Error:', error);
    return false;
  }
};

export const revokeAccess = async (): Promise<boolean> => {
  try {
    await GoogleSignin.revokeAccess();
    return true;
  } catch (error) {
    console.error('Google Revoke Access Error:', error);
    return false;
  }
};

export const getTokens = async () => {
  try {
    return await GoogleSignin.getTokens();
  } catch (error) {
    console.error('Google Get Tokens Error:', error);
    return null;
  }
};

export const clearCachedAccessToken = async (accessToken: string): Promise<boolean> => {
  try {
    await GoogleSignin.clearCachedAccessToken(accessToken);
    return true;
  } catch (error) {
    console.error('Google Clear Cached Token Error:', error);
    return false;
  }
};
