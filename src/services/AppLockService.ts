import * as LocalAuthentication from 'expo-local-authentication';

export interface LockAvailability {
  /** The phone has a fingerprint or face sensor, or any screen lock the system can ask for. */
  available: boolean;
}

/**
 * Whether the system can ask the person to prove who they are. `isEnrolledAsync` is false on a
 * phone with no fingerprint, face or screen lock set up, so the lock cannot be switched on there.
 * With a device passcode but no biometrics the passcode is what is asked for.
 */
export const getLockAvailability = async (): Promise<LockAvailability> => {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return {available: level !== LocalAuthentication.SecurityLevel.NONE};
  } catch {
    return {available: false};
  }
};

/**
 * Shows the system prompt: biometrics first, the device passcode as the fallback (the system
 * button). True only when the person passed.
 */
export const authenticate = async (promptMessage: string): Promise<boolean> => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
};
