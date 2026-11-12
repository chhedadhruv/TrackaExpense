/**
 * Route names of the five bottom tabs. They end in "Tab" on purpose: each tab holds a stack whose
 * first screen is named after the tab ("Home", "Split", ...), and React Navigation warns about the
 * same name nested inside itself and cannot tell which one a navigate() means. Use these constants
 * wherever a tab is named (the tab navigator, the link config, notification taps) so the names stay
 * in one place. The label shown on the tab bar is set separately and is unchanged.
 */
export const TAB = {
  home: 'HomeTab',
  statistic: 'StatisticTab',
  split: 'SplitTab',
  savings: 'SavingsTab',
  profile: 'ProfileTab',
} as const;

export type TabName = (typeof TAB)[keyof typeof TAB];
