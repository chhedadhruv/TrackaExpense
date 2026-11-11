import React from 'react';
import {
  Modal,
  StyleSheet,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {KeyboardAvoidingView} from 'react-native-keyboard-controller';
import {ModalSnackbar} from './Snackbar';

type Props = ModalProps & {
  /** Style of the full-screen layer inside the modal (the dimmed overlay, or the page). */
  overlayStyle?: StyleProp<ViewStyle>;
};

/**
 * A modal whose content moves above the keyboard. A React Native Modal is its own window, so the
 * keyboard handling of the screen behind it does not reach it: without this a field near the
 * bottom of the modal stays behind the keyboard and the user cannot see what they type. The
 * translucent flags make the modal window edge to edge, which the keyboard library needs to
 * measure the keyboard on Android. Use it for every modal that contains a text input.
 */
export const KeyboardAvoidingModal = ({
  overlayStyle,
  children,
  ...modalProps
}: Props) => (
  <Modal statusBarTranslucent navigationBarTranslucent {...modalProps}>
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.fill, overlayStyle]}>
      {children}
      <ModalSnackbar />
    </KeyboardAvoidingView>
  </Modal>
);

const styles = StyleSheet.create({fill: {flex: 1}});

export default KeyboardAvoidingModal;
