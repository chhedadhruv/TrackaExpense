import React, {useEffect, useRef, useState} from 'react';
import {Modal, Platform, Pressable, Text, View} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {useTheme} from '../theme';

interface DatePickerModalProps {
  visible: boolean;
  /** The date the picker opens on. Defaults to today. */
  date?: Date;
  /** Heading of the iOS sheet (Android shows the system dialog's own). */
  label?: string;
  /** The earliest date that can be chosen. */
  minimumDate?: Date;
  /** Called with the chosen date. The picker closes itself right after (onDismiss follows). */
  onConfirm: (params: {date: Date}) => void;
  /** Called when the picker closes, after a choice or a cancel. Hide it here. */
  onDismiss: () => void;
}

/**
 * A single-date picker using the platform's own control: the system dialog on Android and a
 * wheel in a bottom sheet (Cancel and Done) on iOS. `visible` opens it; the caller hides it in
 * `onDismiss`. The Android dialog and the iOS wheel follow the app's light or dark theme.
 */
const DatePickerModal = ({
  visible,
  date,
  label,
  minimumDate,
  onConfirm,
  onDismiss,
}: DatePickerModalProps) => {
  // The latest props, read when the (imperative) Android dialog opens and reports back.
  const latest = useRef({date, minimumDate, onConfirm, onDismiss});
  latest.current = {date, minimumDate, onConfirm, onDismiss};

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) {
      return;
    }
    DateTimePickerAndroid.open({
      mode: 'date',
      value: latest.current.date ?? new Date(),
      minimumDate: latest.current.minimumDate,
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === 'set' && selected) {
          latest.current.onConfirm({date: selected});
        }
        latest.current.onDismiss();
      },
    });
    return () => {
      // Closes the dialog if the screen hides it or unmounts first; a no-op once it is closed.
      DateTimePickerAndroid.dismiss('date').catch(() => {});
    };
  }, [visible]);

  if (Platform.OS !== 'ios' || !visible) {
    return null;
  }
  return (
    <IosDateSheet
      initial={date ?? new Date()}
      label={label}
      minimumDate={minimumDate}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
};

interface IosDateSheetProps {
  initial: Date;
  label?: string;
  minimumDate?: Date;
  onConfirm: (params: {date: Date}) => void;
  onDismiss: () => void;
}

/** Mounted only while open, so the wheel always starts on the date the caller passed. */
const IosDateSheet = ({
  initial,
  label,
  minimumDate,
  onConfirm,
  onDismiss,
}: IosDateSheetProps) => {
  const {colors, isDark} = useTheme();
  const [chosen, setChosen] = useState(initial);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onDismiss}>
      <Pressable
        className="flex-1 justify-end bg-overlay"
        accessibilityLabel="Close date picker"
        onPress={onDismiss}>
        <Pressable className="rounded-t-2xl bg-surface pb-8">
          <View className="flex-row items-center justify-between border-b border-divider px-5 py-3.5">
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onDismiss}>
              <Text className="font-sans text-base text-text-secondary">
                Cancel
              </Text>
            </Pressable>
            <Text
              accessibilityRole="header"
              className="font-sans-bold text-base text-text-strong">
              {label ?? 'Select date'}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                onConfirm({date: chosen});
                onDismiss();
              }}>
              <Text className="font-sans-bold text-base text-primary">
                Done
              </Text>
            </Pressable>
          </View>
          <DateTimePicker
            mode="date"
            display="spinner"
            value={chosen}
            minimumDate={minimumDate}
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={colors.text}
            onChange={(_event, selected) => selected && setChosen(selected)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default DatePickerModal;
