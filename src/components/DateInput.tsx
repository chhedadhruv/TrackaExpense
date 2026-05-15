import React, {useState} from 'react';
import {View, Text, TouchableOpacity, Platform, StyleSheet} from 'react-native';
import {DatePickerModal} from 'react-native-paper-dates';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {PRIMARY_COLOR} from '../constants/theme';
import {formatDisplayDate} from '../utils/formatters';

interface DateInputProps {
  /** "YYYY-MM-DD" plain string */
  date: string;
  onConfirm: (dateString: string) => void;
  disabled?: boolean;
  label?: string;
}

const DateInput = ({date, onConfirm, disabled = false, label}: DateInputProps) => {
  const [open, setOpen] = useState(false);

  const handleConfirm = (params: any) => {
    setOpen(false);
    const selectedDate: Date = params.date;
    const formatted = `${selectedDate.getFullYear()}-${String(
      selectedDate.getMonth() + 1,
    ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    onConfirm(formatted);
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TouchableOpacity
          style={[styles.triggerButton, disabled && styles.triggerDisabled]}
          onPress={() => !disabled && setOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label ?? 'Select date'}>
          <MaterialCommunityIcons
            name="calendar"
            size={20}
            color={PRIMARY_COLOR}
            style={styles.icon}
          />
          <Text style={[styles.dateText, !date && styles.placeholderText]}>
            {date ? formatDisplayDate(date) : 'Select date'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
        </TouchableOpacity>
        <DatePickerModal
          locale="en"
          mode="single"
          visible={open}
          onDismiss={() => setOpen(false)}
          date={date ? new Date(date) : new Date()}
          onConfirm={handleConfirm}
          saveLabel="Confirm"
          label="Select date"
          uppercase={false}
          {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
        />
      </View>
    </SafeAreaProvider>
  );
};

export default DateInput;

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    color: '#333',
    marginBottom: 6,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  triggerDisabled: {
    backgroundColor: '#F5F5F5',
  },
  icon: {
    marginRight: 10,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    fontFamily: 'Lato-Regular',
  },
  placeholderText: {
    color: '#999',
  },
});
