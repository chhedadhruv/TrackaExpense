import {doc, getFirestore, updateDoc} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';

/**
 * Saves the evening reminder switch on the signed-in person's own profile. One field only, so it
 * never overwrites anything another screen or device changed. The profile listener hands the new
 * value back (a local write shows at once, also offline), so callers do not refetch.
 */
export const setFunNudgeEnabled = async (enabled: boolean): Promise<void> => {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }
  await updateDoc(doc(getFirestore(), 'users', user.uid), {
    funNudgeEnabled: enabled,
  });
};
