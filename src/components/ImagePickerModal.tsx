import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Modal, Portal} from 'react-native-paper';
import Camera from 'lucide-react-native/icons/camera';
import Images from 'lucide-react-native/icons/images';
import {pickImageFromCamera, pickImageFromLibrary} from '../utils/imagePicker';
import {useTheme} from '../theme';

// The Paper Modal draws its own container; the card inside carries the colours.
const SHEET_CONTAINER = {margin: 20, backgroundColor: 'transparent'} as const;

interface ImagePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onImageSelected: (uri: string) => void;
}

const ImagePickerModal = ({
  visible,
  onDismiss,
  onImageSelected,
}: ImagePickerModalProps) => {
  const {colors} = useTheme();

  const handleTakePhoto = async () => {
    const uri = await pickImageFromCamera();
    if (uri) {
      onImageSelected(uri);
    }
    onDismiss();
  };

  const handleChooseFromLibrary = async () => {
    const uri = await pickImageFromLibrary();
    if (uri) {
      onImageSelected(uri);
    }
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        contentContainerStyle={SHEET_CONTAINER}
        onDismiss={onDismiss}>
        <View className="rounded-2xl bg-surface p-5 shadow-lg">
          <View className="mb-5 items-center gap-2">
            <Camera size={32} color={colors.primary} />
            <Text
              accessibilityRole="header"
              className="font-sans-bold text-lg text-text">
              Add Receipt Image
            </Text>
          </View>
          <TouchableOpacity
            className="mb-2.5 flex-row items-center gap-3 rounded-[10px] border border-border p-3.5"
            accessibilityRole="button"
            onPress={handleTakePhoto}>
            <Camera size={24} color={colors.primary} />
            <Text className="font-sans text-base text-text">Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mb-2.5 flex-row items-center gap-3 rounded-[10px] border border-border p-3.5"
            accessibilityRole="button"
            onPress={handleChooseFromLibrary}>
            <Images size={24} color={colors.primary} />
            <Text className="font-sans text-base text-text">
              Choose from Gallery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mb-2.5 mt-1 flex-row items-center justify-center gap-3 rounded-[10px] border border-expense p-3.5"
            accessibilityRole="button"
            onPress={onDismiss}>
            <Text className="font-sans-bold text-base text-expense-text">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Portal>
  );
};

export default ImagePickerModal;
