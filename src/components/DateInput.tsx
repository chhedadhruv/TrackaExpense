import React, {useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import DatePickerModal from './DatePickerModal';
import Calendar from 'lucide-react-native/icons/calendar';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import {useTheme} from '../theme';
import {formatDisplayDate} from '../utils/formatters';

interface DateInputProps {
  /** "YYYY-MM-DD" plain string */
  date: string;
  onConfirm: (dateString: string) => void;
  disabled?: boolean;
  label?: string;
}

const DateInput = ({
  date,
  onConfirm,
  disabled = false,
  label,
}: DateInputProps) => {
  const {colors} = useTheme();
  const [open, setOpen] = useState(false);

  const handleConfirm = ({date: selectedDate}: {date: Date}) => {
    const formatted = `${selectedDate.getFullYear()}-${String(
      selectedDate.getMonth() + 1,
    ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    onConfirm(formatted);
  };

  return (
    <View className="mb-2">
      {label && (
        <Text className="mb-1.5 font-sans-bold text-sm text-text">{label}</Text>
      )}
      <TouchableOpacity
        className={`min-h-[48px] flex-row items-center rounded-[10px] border border-border px-3.5 py-[13px] ${
          disabled ? 'bg-surface-muted' : 'bg-surface'
        }`}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select date'}>
        <View className="mr-2.5">
          <Calendar size={20} color={colors.primary} />
        </View>
        <Text
          className={`flex-1 font-sans text-[15px] ${
            date ? 'text-text' : 'text-text-placeholder'
          }`}>
          {date ? formatDisplayDate(date) : 'Select date'}
        </Text>
        <ChevronDown size={20} color={colors.textPlaceholder} />
      </TouchableOpacity>
      <DatePickerModal
        visible={open}
        onDismiss={() => setOpen(false)}
        date={date ? new Date(date) : new Date()}
        onConfirm={handleConfirm}
        label="Select date"
      />
    </View>
  );
};

export default DateInput;
