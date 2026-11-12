import React, {type ReactNode} from 'react';
import {Text, View} from 'react-native';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import {useTheme} from '../../theme';
import type {AppIcon} from '../../types/icons';

/**
 * Small building blocks shared by the add and edit forms (expense, income, transaction), so they
 * look the same and follow the theme from one place.
 */

interface FormHeaderProps {
  icon: AppIcon;
  /** Icon colour, usually the income or expense colour from useTheme(). */
  iconColor: string;
  title: string;
  subtitle: string;
}

/** The screen title: a coloured icon, the heading and one line of help. */
export const FormHeader = ({
  icon: Icon,
  iconColor,
  title,
  subtitle,
}: FormHeaderProps) => (
  <View className="items-center px-5 pb-5 pt-[30px]">
    <View className="mb-2 flex-row items-center">
      <Icon size={32} color={iconColor} />
      <Text
        accessibilityRole="header"
        className="ml-3 font-heading text-[28px] font-bold text-primary">
        {title}
      </Text>
    </View>
    <Text className="text-center font-sans text-base text-text-secondary">
      {subtitle}
    </Text>
  </View>
);

/** The white (or charcoal) card that holds the form fields. */
export const FormCard = ({children}: {children: ReactNode}) => (
  <View className="mx-5 mb-10 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
    <View className="p-[30px]">{children}</View>
  </View>
);

/** A field block: spacing below, and a bold label with an optional "(Optional)" hint. */
export const FormSection = ({
  label,
  optional = false,
  children,
}: {
  label?: string;
  optional?: boolean;
  children: ReactNode;
}) => (
  <View className="mb-5">
    {label ? (
      <Text className="mb-2 font-sans-bold text-base font-semibold text-text-strong">
        {label}
        {optional ? (
          <Text className="font-sans text-sm font-normal text-text-placeholder">
            {' (Optional)'}
          </Text>
        ) : null}
      </Text>
    ) : null}
    {children}
  </View>
);

/** The red banner at the top of a form. Announced to screen readers when it appears. */
export const FormError = ({message}: {message: string}) => {
  const {colors} = useTheme();
  return (
    <View
      accessibilityRole="alert"
      className="mb-5 flex-row items-center rounded-xl border-l-4 border-expense bg-expense-soft p-[15px]">
      <CircleAlert size={20} color={colors.expenseText} />
      <Text className="ml-2.5 flex-1 font-sans text-sm text-expense-text">
        {message}
      </Text>
    </View>
  );
};
