import {doc, getFirestore, updateDoc} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';

type NotificationPrefField = 'funNudgeEnabled' | 'cardRemindersEnabled';

/**
 * Saves one notification switch on the signed-in person's own profile. One field only, so it
 * never overwrites anything another screen or device changed. The profile listener hands the new
 * value back (a local write shows at once, also offline), so callers do not refetch.
 */
const setPref = async (
  field: NotificationPrefField,
  enabled: boolean,
): Promise<void> => {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }
  await updateDoc(doc(getFirestore(), 'users', user.uid), {[field]: enabled});
};

/** The evening reminder (`funNudge` in functions/). */
export const setFunNudgeEnabled = (enabled: boolean): Promise<void> =>
  setPref('funNudgeEnabled', enabled);

/** The credit card bill reminders (`cardDueReminders` in functions/). */
export const setCardRemindersEnabled = (enabled: boolean): Promise<void> =>
  setPref('cardRemindersEnabled', enabled);
