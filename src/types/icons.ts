import type {LucideIcon} from 'lucide-react-native';
import type {FC} from 'react';

/**
 * An icon is a component, never a glyph name. UI icons come from `lucide-react-native` (import each
 * one from `lucide-react-native/icons/<name>`, never from the package barrel). Brand marks lucide
 * does not have are small `react-native-svg` components in `src/components/icons/`.
 */
export type AppIcon = LucideIcon | FC<{size?: number; color?: string}>;
