import {doc, getFirestore, updateDoc} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';

/**
 * Saves the device time zone on the signed-in person's own profile. One field only, so it never
 * overwrites anything another screen or device changed.
 */
export const saveTimeZone = async (zone: string): Promise<void> => {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }
  await updateDoc(doc(getFirestore(), 'users', user.uid), {timeZone: zone});
};
