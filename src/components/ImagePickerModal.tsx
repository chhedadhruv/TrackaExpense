import React from 'react';
import {Pressable, View, Text, TouchableOpacity} from 'react-native';
import Camera from 'lucide-react-native/icons/camera';
import Images from 'lucide-react-native/icons/images';
import {pickImageFromCamera, pickImageFromLibrary} from '../utils/imagePicker';
import {useTheme} from '../theme';
import KeyboardAvoidingModal from './KeyboardAvoidingModal';

// The dimmed layer is the Pressable behind the card; the card sits centred on top of it.
const OVERLAY = {justifyContent: 'center'} as const;

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
    <KeyboardAvoidingModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onDismiss}
      overlayStyle={OVERLAY}>
      <Pressable
        className="absolute inset-0 bg-overlay"
        accessibilityLabel="Close"
        onPress={onDismiss}
      />
      <View className="mx-5">
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
      </View>
    </KeyboardAvoidingModal>
  );
};

export default ImagePickerModal;
