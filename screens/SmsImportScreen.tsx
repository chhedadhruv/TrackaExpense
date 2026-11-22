import React, {useState} from 'react';
import {Text, TextInput, View} from 'react-native';
import {useRouter} from 'expo-router';
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import FormButton from '../components/FormButton';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {
  FormCard,
  FormHeader,
  FormSection,
} from '../src/components/form/FormParts';
import {useTheme} from '../src/theme';
import {useCurrency} from '../utils/CurrencyUtil';
import {formatDisplayDate} from '../src/utils/formatters';
import {parseSms} from '../src/utils/sms/parse';
import type {ParsedSms} from '../src/utils/sms/types';
import {useCards} from '../src/hooks/useCards';
import {getConfig} from '../src/services/RemoteConfigService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {
  matchCard,
  prefillFor,
  prefillParams,
  targetFor,
  titleFor,
} from '../src/utils/smsImport';

const MAX_MESSAGE = 1000;
const TOP_ALIGNED = {textAlignVertical: 'top'} as const;

/**
 * Add an expense or income from a bank message the person pastes. The text is read on the phone
 * and goes nowhere. The result only opens the normal Add form with the values filled in, so
 * nothing is saved until the person confirms it there.
 */
const SmsImportScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {currency, formatAmount} = useCurrency();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedSms | null>(null);
  const [checked, setChecked] = useState(false);

  const read = () => {
    const result = parseSms({body: text, receivedAt: new Date()});
    setParsed(result);
    setChecked(true);
    AnalyticsService.logBankMessageParsed({
      recognized: result !== null,
      target: result ? targetFor(result) : 'none',
    });
  };

  const cards = useCards().data;
  const basePrefill = parsed ? prefillFor(parsed, currency.code) : null;
  // A card payment whose last digits match exactly one of the person's cards pre-selects that
  // card on the form; Add Expense still lets them change it.
  const matchedCard =
    parsed && getConfig().enable_cards ? matchCard(parsed, cards ?? []) : null;
  const prefill =
    basePrefill && matchedCard
      ? {...basePrefill, cardId: matchedCard}
      : basePrefill;
  const target = parsed ? targetFor(parsed) : null;

  const review = () => {
    if (!parsed || !prefill || !target) {
      return;
    }
    router.push({
      pathname: target === 'expense' ? '/expense/add' : '/income/add',
      params: prefillParams(prefill),
    });
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5">
      <FormHeader
        icon={MessageSquareText}
        iconColor={colors.primary}
        title="Bank message"
        subtitle="Paste a message from your bank to fill in an expense or income."
      />
      <FormCard>
        <FormSection label="Message">
          <TextInput
            className="min-h-[120px] rounded-xl border border-card-border bg-surface-muted p-[15px] font-sans text-base text-text"
            style={TOP_ALIGNED}
            multiline
            maxLength={MAX_MESSAGE}
            value={text}
            onChangeText={value => {
              setText(value);
              setChecked(false);
            }}
            placeholder="Rs.500.00 debited from a/c XX1234 on 15-11-26 to VPA shop@upi"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Bank message"
          />
          <Text className="mt-2 font-sans text-xs text-text-secondary">
            The message is read on your phone and is not sent anywhere. Nothing
            is saved until you confirm it on the next screen.
          </Text>
        </FormSection>

        <FormButton
          buttonTitle="Read message"
          onPress={read}
          disabled={text.trim() === ''}
        />

        {checked && !parsed ? (
          <View
            className="mt-5 rounded-xl border border-card-border bg-surface-muted p-4"
            accessibilityLiveRegion="polite">
            <Text className="font-sans text-sm text-text">
              This does not look like a completed payment or deposit. One-time
              passwords, offers, reminders and failed payments are skipped. You
              can still add the expense by hand.
            </Text>
          </View>
        ) : null}

        {parsed && target ? (
          <View
            className="mt-5 rounded-xl border border-card-border bg-surface-muted p-4"
            accessibilityLiveRegion="polite">
            <View className="flex-row items-center">
              {target === 'expense' ? (
                <ArrowUpRight size={22} color={colors.expense} />
              ) : (
                <ArrowDownLeft size={22} color={colors.income} />
              )}
              <Text className="ml-2 font-sans-bold text-base font-semibold text-text-strong">
                {target === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </View>
            <Text className="mt-2 font-heading text-2xl font-bold text-text-strong">
              {prefill
                ? formatAmount(Number(parsed.amount))
                : `${parsed.currency} ${parsed.amount}`}
            </Text>
            <Text className="mt-1 font-sans text-sm text-text-secondary">
              {titleFor(parsed)} on {formatDisplayDate(parsed.date)}
              {parsed.account ? `, account ending ${parsed.account}` : ''}
            </Text>
            {prefill ? (
              <View className="mt-4">
                <FormButton
                  buttonTitle={
                    target === 'expense'
                      ? 'Review and add expense'
                      : 'Review and add income'
                  }
                  onPress={review}
                />
              </View>
            ) : (
              <Text className="mt-3 font-sans text-sm text-expense-text">
                This message is in {parsed.currency}, but your currency is{' '}
                {currency.code}. Nothing is converted, so add it by hand.
              </Text>
            )}
          </View>
        ) : null}
      </FormCard>
    </KeyboardAwareScrollView>
  );
};

export default SmsImportScreen;
