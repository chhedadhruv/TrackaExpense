/**
 * Copy of the first-launch onboarding pages. Kept apart from the screen so a test can check it:
 * three pages, unique titles, no emoji, and no hard-coded dollar sign (the app defaults to rupees
 * and supports many currencies).
 */

export type OnboardingIllustration = 'track' | 'split' | 'save';

export interface OnboardingPage {
  illustration: OnboardingIllustration;
  title: string;
  subtitle: string;
  /** Spoken description of the illustration for screen readers. */
  imageLabel: string;
}

export const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  {
    illustration: 'track',
    title: 'Know where your money goes',
    subtitle:
      'Add expenses and income in seconds, attach receipts, and see your spending by category.',
    imageLabel: 'A bar chart with a rising trend line and a coin',
  },
  {
    illustration: 'split',
    title: 'Split with friends, settle up fast',
    subtitle:
      'Create groups, divide any bill, and record payments so everyone stays even.',
    imageLabel: 'A shared receipt with three people around it',
  },
  {
    illustration: 'save',
    title: 'Reach your savings goals',
    subtitle: 'Set a target, add money as you go, and watch each goal fill up.',
    imageLabel: 'A jar filling with coins',
  },
];
