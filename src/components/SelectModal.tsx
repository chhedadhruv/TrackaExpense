import React, {useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTheme, useThemedStyles, type ThemeColors} from '../theme';
import {KeyboardAvoidingModal} from './KeyboardAvoidingModal';

export interface SelectOption {
  label: string;
  value: string;
  icon?: () => React.ReactNode;
}

interface SelectModalProps {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
}

const SelectModal = ({
  value,
  options,
  onChange,
  placeholder = 'Select',
  title,
  searchPlaceholder = 'Search...',
}: SelectModalProps) => {
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find(o => o.value === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <TouchableOpacity
        style={styles.field}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}>
        {selected?.icon ? (
          <View style={styles.icon}>{selected.icon()}</View>
        ) : null}
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </Text>
      </TouchableOpacity>
      <KeyboardAvoidingModal
        visible={open}
        animationType="slide"
        onRequestClose={close}
        transparent={false}
        overlayStyle={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>{title ?? placeholder}</Text>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textPlaceholder}
        />
        <FlatList
          data={filtered}
          keyExtractor={item => item.value}
          keyboardShouldPersistTaps="handled"
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.row,
                item.value === value ? styles.rowSelected : null,
              ]}
              onPress={() => {
                onChange(item.value);
                close();
              }}>
              {item.icon ? (
                <View style={styles.icon}>{item.icon()}</View>
              ) : null}
              <Text style={styles.rowText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </KeyboardAvoidingModal>
    </>
  );
};

export default SelectModal;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 10,
      marginVertical: 10,
      paddingHorizontal: 12,
      minHeight: 50,
      backgroundColor: colors.surface,
    },
    value: {fontSize: 16, color: colors.textStrong},
    placeholder: {fontSize: 16, color: colors.textPlaceholder},
    icon: {marginRight: 10},
    modal: {flex: 1, backgroundColor: colors.surface, paddingTop: 48},
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    title: {fontSize: 18, fontWeight: '600', color: colors.textStrong},
    close: {fontSize: 16, color: colors.primary},
    search: {
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 10,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      height: 44,
      color: colors.textStrong,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowSelected: {backgroundColor: colors.primarySoft},
    rowText: {fontSize: 16, color: colors.textStrong},
  });
