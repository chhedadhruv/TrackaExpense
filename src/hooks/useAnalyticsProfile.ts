import {useEffect} from 'react';
import {getAuth} from '@react-native-firebase/auth';
import {useUserData} from '../data/hooks';
import {useAppLock} from '../lock/AppLockProvider';
import {setUserProperties} from '../services/AnalyticsService';
import {useTheme} from '../theme';
import {buildAnalyticsProfile} from '../utils/analyticsProfile';

/**
 * Keeps the analytics people-profile current: currency, sign-in method, whether the person has
 * savings goals, the app lock and the theme. It reads only what is already in the cache, so it
 * adds no Firestore reads. Call it once, inside the signed-in app.
 */
export const useAnalyticsProfile = (): void => {
  const {data} = useUserData();
  const {enabled: appLockEnabled} = useAppLock();
  const {mode} = useTheme();
  const currency = data?.currency;
  const savingsGoalCount = data?.savingsGoals?.length ?? 0;
  const hasProfile = data !== undefined && data !== null;

  useEffect(() => {
    if (!hasProfile) {
      return;
    }
    const providerIds = (getAuth().currentUser?.providerData ?? []).map(
      provider => provider.providerId,
    );
    setUserProperties(
      buildAnalyticsProfile({
        currency,
        savingsGoalCount,
        appLockEnabled,
        theme: mode,
        providerIds,
      }),
    );
  }, [hasProfile, currency, savingsGoalCount, appLockEnabled, mode]);
};
