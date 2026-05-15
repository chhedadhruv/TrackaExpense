import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import {Modal, Portal} from 'react-native-paper';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {requestCameraPermission} from '../../utils/Permissions';
import {PRIMARY_COLOR, EXPENSE_COLOR} from '../constants/theme';

interface ImagePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onImageSelected: (uri: string) => void;
}

const ImagePickerModal = ({visible, onDismiss, onImageSelected}: ImagePickerModalProps) => {
  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    launchCamera(
      {mediaType: 'photo', includeBase64: false, quality: 0.8},
      response => {
        if (!response.didCancel && !response.errorCode && response.assets?.[0]?.uri) {
          onImageSelected(response.assets[0].uri);
        }
        onDismiss();
      },
    );
  };

  const handleChooseFromLibrary = () => {
    launchImageLibrary(
      {mediaType: 'photo', includeBase64: false, quality: 0.8},
      response => {
        if (!response.didCancel && !response.errorCode && response.assets?.[0]?.uri) {
          onImageSelected(response.assets[0].uri);
        }
        onDismiss();
      },
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        contentContainerStyle={styles.container}
        onDismiss={onDismiss}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="camera" size={32} color={PRIMARY_COLOR} />
          <Text style={styles.title}>Add Receipt Image</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleTakePhoto}>
          <MaterialCommunityIcons name="camera" size={24} color={PRIMARY_COLOR} />
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleChooseFromLibrary}>
          <MaterialCommunityIcons name="image-multiple" size={24} color={PRIMARY_COLOR} />
          <Text style={styles.buttonText}>Choose from Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onDismiss}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Modal>
    </Portal>
  );
};

export default ImagePickerModal;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.15, shadowRadius: 12},
      android: {elevation: 8},
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Lato-Bold',
    color: '#333',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
    gap: 12,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Lato-Regular',
    color: '#333',
  },
  cancelButton: {
    borderColor: EXPENSE_COLOR,
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: 'Lato-Bold',
    color: EXPENSE_COLOR,
  },
});
