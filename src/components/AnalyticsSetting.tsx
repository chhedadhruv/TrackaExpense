import React, {useState} from 'react';
import {Text, View} from 'react-native';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import {isAnalyticsEnabled} from '../services/AnalyticsPrefs';
import {setAnalyticsEnabled} from '../services/MixpanelService';
import {useTheme} from '../theme';
import Toggle from './Toggle';

/**
 * The "Privacy" section of Profile with the usage analytics switch. The choice is kept on the
 * phone (it survives sign-out) and applies at once: when off, no usage events are sent.
 */
const AnalyticsSetting = () => {
  const {colors} = useTheme();
  const [enabled, setEnabled] = useState(isAnalyticsEnabled);

  const change = (next: boolean) => {
    setEnabled(next);
    setAnalyticsEnabled(next);
  };

  return (
    <View className="px-5 pb-[30px]">
      <Text
        accessibilityRole="header"
        className="mb-[15px] font-heading text-xl font-bold text-text-strong">
        Privacy
      </Text>
      <View className="rounded-2xl border border-card-border bg-surface ios:shadow-md">
        <View className="flex-row items-center justify-between px-5 py-4">
          <View className="flex-1 flex-row items-center">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
              <ChartColumn size={24} color={colors.primary} />
            </View>
            <View className="flex-1 pr-3">
              <Text className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong">
                Usage analytics
              </Text>
              <Text className="font-sans text-sm text-text-secondary">
                Share which features you use, with no names, titles or exact
                amounts, to help improve the app
              </Text>
            </View>
          </View>
          <Toggle value={enabled} onValueChange={change} />
        </View>
      </View>
    </View>
  );
};

export default AnalyticsSetting;
