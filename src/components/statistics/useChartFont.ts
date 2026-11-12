import {useFont} from '@shopify/react-native-skia';

/** The app's body font for Skia-drawn chart labels (null for a moment while it loads). */
export const useChartFont = (size: number) =>
  useFont(require('../../../assets/fonts/Lato-Regular.ttf'), size);
