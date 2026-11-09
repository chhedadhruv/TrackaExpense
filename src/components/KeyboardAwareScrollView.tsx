import React from 'react';
import {KeyboardAwareScrollView as BaseKeyboardAwareScrollView} from 'react-native-keyboard-controller';

/**
 * How far above the keyboard the focused field is kept, in dp. The library's default is 0, which
 * scrolls the field only until it touches the top of the keyboard: its lower edge is cut off and
 * the user cannot see what they are typing. About one and a half field heights leaves the whole
 * field, its counter or error line and a little of the next field in view.
 */
export const KEYBOARD_BOTTOM_OFFSET = 96;

type Props = React.ComponentProps<typeof BaseKeyboardAwareScrollView>;

/** The app's keyboard-aware scroll container. Use this instead of the library's own. */
export const KeyboardAwareScrollView = ({
  bottomOffset = KEYBOARD_BOTTOM_OFFSET,
  ...rest
}: Props) => (
  <BaseKeyboardAwareScrollView bottomOffset={bottomOffset} {...rest} />
);

export default KeyboardAwareScrollView;
