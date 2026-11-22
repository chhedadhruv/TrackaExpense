import React from 'react';
import Tabs from 'expo-router/js-tabs';
import {useTheme} from '../../src/theme';
import {useAnalyticsProfile} from '../../src/hooks/useAnalyticsProfile';
import {renderTabBar, tabIcons} from '../../src/navigation/AppTabBar';

/**
 * The five tabs. Each tab is a folder of its own with a stack inside, so detail screens open
 * above the list and the tab bar stays visible, as it always did.
 */
const AppLayout = () => {
  const {colors} = useTheme();
  useAnalyticsProfile();
  return (
    <Tabs
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: tabIcons.home(colors.primary),
        }}
      />
      <Tabs.Screen
        name="(statistic)"
        options={{
          tabBarLabel: 'Statistic',
          tabBarIcon: tabIcons.statistic(colors.primary),
        }}
      />
      <Tabs.Screen
        name="(split)"
        options={{
          tabBarLabel: 'Split',
          tabBarIcon: tabIcons.split(colors.primary),
        }}
      />
      <Tabs.Screen
        name="(savings)"
        options={{
          tabBarLabel: 'Savings',
          tabBarIcon: tabIcons.savings(colors.primary),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: tabIcons.profile(colors.primary),
        }}
      />
    </Tabs>
  );
};

export default AppLayout;
