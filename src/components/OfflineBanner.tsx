import React, {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
// Deep import: the package barrel would pull every icon into the bundle.
import WifiOff from 'lucide-react-native/icons/wifi-off';
import {useIsOnline} from '../services/ConnectivityService';
import {useTheme} from '../theme';
import {OFFLINE_BANNER_DELAY_MS} from '../utils/connectivity';

/**
 * A thin strip under the status bar while the phone is offline. It waits a moment before showing,
 * so a brief drop does not flash it. Changes made offline are kept on the phone and sync by
 * themselves when the connection is back.
 */
const OfflineBanner = () => {
  const online = useIsOnline();
  const {colors} = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (online) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), OFFLINE_BANNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [online]);

  if (!visible) {
    return null;
  }
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-center justify-center bg-warning-soft px-4 py-2">
      <WifiOff size={16} color={colors.warningText} />
      <Text className="ml-2 flex-shrink font-sans text-sm text-warning-text">
        You are offline. Changes are saved on this phone and sync when you are
        back online.
      </Text>
    </View>
  );
};

export default OfflineBanner;
