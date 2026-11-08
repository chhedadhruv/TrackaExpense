import type {ComponentProps} from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type AntDesign from '@expo/vector-icons/AntDesign';

/** Valid glyph names for MaterialCommunityIcons. Invalid names fail type-check. */
export type McIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Valid glyph names for AntDesign. */
export type AntIconName = ComponentProps<typeof AntDesign>['name'];
