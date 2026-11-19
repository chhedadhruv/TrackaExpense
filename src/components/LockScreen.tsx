import React, {useContext, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import {AuthContext} from '../../navigation/AuthProvider';
import {useAppLock} from '../lock/AppLockProvider';
import {useTheme} from '../theme';

/**
 * Covers the whole app while it is locked. The screens underneath stay mounted (a push tap or an
 * invite link that arrives meanwhile is kept), they are just not reachable. The system prompt
 * opens by itself once; after "Cancel" the person taps Unlock to try again, or signs out, so a
 * broken sensor can never trap them.
 */
const LockScreen = () => {
  const {colors} = useTheme();
  const {unlock} = useAppLock();
  const {logout} = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const prompted = useRef(false);

  const tryUnlock = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await unlock();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (prompted.current || AppState.currentState !== 'active') {
      return;
    }
    prompted.current = true;
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Android back button must not reach the screens behind the lock.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => subscription.remove();
  }, []);

  return (
    <View
      style={StyleSheet.absoluteFill}
      className="items-center justify-center bg-background px-8"
      accessibilityViewIsModal>
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-surface-muted">
        <LockKeyhole size={36} color={colors.primary} />
      </View>
      <Text className="mb-2 font-heading text-2xl font-bold text-text-strong">
        TrackaExpense is locked
      </Text>
      <Text className="mb-8 text-center font-sans text-base text-text-secondary">
        Use your fingerprint, face or device passcode to continue.
      </Text>
      <TouchableOpacity
        className="min-h-[48px] w-full items-center justify-center rounded-xl bg-primary-fill px-6"
        accessibilityRole="button"
        accessibilityLabel="Unlock"
        disabled={busy}
        onPress={tryUnlock}
        activeOpacity={0.8}>
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text className="font-sans-bold text-base font-semibold text-on-primary">
            Unlock
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        className="mt-4 min-h-[48px] items-center justify-center px-6"
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => logout()}
        activeOpacity={0.7}>
        <Text className="font-sans-bold text-base text-text-secondary">
          Sign out
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default LockScreen;
