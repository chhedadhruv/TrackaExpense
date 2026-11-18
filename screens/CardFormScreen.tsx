import React, {useEffect, useState} from 'react';
import {Alert, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Hash from 'lucide-react-native/icons/hash';
import Calendar from 'lucide-react-native/icons/calendar';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {
  FormCard,
  FormError,
  FormHeader,
} from '../src/components/form/FormParts';
import TextField from '../src/components/form/TextField';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import FormButton from '../components/FormButton';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {useCardActions, useCards} from '../src/hooks/useCards';
import {useTransactions} from '../src/data/hooks';
import {reportError} from '../src/services/ErrorReporter';
import {getConfig} from '../src/services/RemoteConfigService';
import {useTheme} from '../src/theme';
import {
  CARD_LAST4_LENGTH,
  CARD_NAME_MAX,
  cardErrorMessage,
  cardIdOf,
  validateCardInput,
} from '../src/utils/cards';
import {snackbar} from '../src/utils/snackbarStore';
import {useCurrency} from '../utils/CurrencyUtil';

const toDay = (text: string): number | null => {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
};

/**
 * Adds or edits a credit card (`/profile/card-form`, with `id` to edit). Only a name and the
 * statement day are needed; the due day is optional (without it there is no reminder).
 */
const CardFormScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {currency} = useCurrency();
  const {id} = useLocalSearchParams<{id?: string}>();
  const editing = typeof id === 'string' && id !== '';
  const cards = useCards();
  const transactions = useTransactions();
  const {save, archive, remove} = useCardActions();
  const existing = editing ? cards.data?.find(c => c.id === id) : undefined;

  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [statementText, setStatementText] = useState('');
  const [dueText, setDueText] = useState('');
  const [filled, setFilled] = useState(!editing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !filled) {
      setName(existing.name);
      setLast4(existing.last4 ?? '');
      setStatementText(String(existing.statementDay));
      setDueText(existing.dueDay === null ? '' : String(existing.dueDay));
      setFilled(true);
    }
  }, [existing, filled]);

  const submit = async () => {
    const statementDay = toDay(statementText);
    const dueDay = toDay(dueText);
    const problem = validateCardInput({name, last4, statementDay, dueDay});
    if (problem !== null || statementDay === null) {
      setError(cardErrorMessage(problem ?? 'statementDay'));
      return;
    }
    setError(null);
    try {
      await save(editing ? (id as string) : null, {
        name: name.trim(),
        last4: last4 === '' ? null : last4,
        statementDay,
        dueDay,
        // The currency a card's bill is added up in; fixed when the card is made.
        currency: existing?.currency ?? currency.code,
        archived: existing?.archived ?? false,
      });
      snackbar.success(editing ? 'Card updated' : 'Card added');
      router.back();
    } catch (e) {
      reportError(e as Error);
      setError('Could not save the card. Check your connection and try again.');
    }
  };
  const {run: handleSave, pending: saving} = useAsyncAction(submit);

  const removeIt = async () => {
    if (!existing) {
      return;
    }
    const used = (transactions.data ?? []).some(
      t => cardIdOf(t) === existing.id,
    );
    try {
      // A card with purchases is archived (kept for its history); an unused one is deleted.
      if (used) {
        await archive(existing.id);
        snackbar.success('Card archived');
      } else {
        await remove(existing.id);
        snackbar.success('Card deleted');
      }
      router.back();
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Could not remove the card. Try again.');
    }
  };
  const {run: handleRemove, pending: removing} = useAsyncAction(removeIt);

  const confirmRemove = () =>
    Alert.alert(
      'Remove card',
      'Purchases already made with this card stay in your transactions. The card can no longer be chosen for new ones.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Remove', style: 'destructive', onPress: handleRemove},
      ],
    );

  if (!getConfig().enable_cards) {
    return (
      <EmptyState
        fill
        icon={CreditCard}
        title="Cards are not available yet"
        message="This feature is being rolled out. Check again soon."
      />
    );
  }
  if (editing && !filled) {
    if (cards.error || (!cards.loading && !existing)) {
      return (
        <ErrorState
          title="Could not load this card"
          message="It may have been removed, or the connection failed."
          onRetry={() => {
            cards.refetch();
          }}
        />
      );
    }
    return <LoadingState message="Loading the card..." />;
  }

  const busy = saving || removing;
  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <FormHeader
          icon={CreditCard}
          iconColor={colors.primary}
          title={editing ? 'Edit Card' : 'Add Card'}
          subtitle="Track what you spend on a card and when its bill is due"
        />
        <FormCard>
          {error ? <FormError message={error} /> : null}

          <TextField
            label="Card name"
            icon={CreditCard}
            maxLength={CARD_NAME_MAX}
            value={name}
            onChangeText={setName}
            placeholder="For example, HDFC Regalia"
            disabled={busy}
          />

          <TextField
            label="Last four digits"
            optional
            icon={Hash}
            maxLength={CARD_LAST4_LENGTH}
            value={last4}
            onChangeText={text => setLast4(text.replace(/\D/g, ''))}
            placeholder="1234"
            disabled={busy}
          />

          <TextField
            label="Statement day (1 to 28)"
            icon={Calendar}
            maxLength={2}
            value={statementText}
            onChangeText={text => setStatementText(text.replace(/\D/g, ''))}
            placeholder="Day of the month the statement is made, for example 15"
            disabled={busy}
          />

          <TextField
            label="Payment due day (1 to 28)"
            optional
            icon={Calendar}
            maxLength={2}
            value={dueText}
            onChangeText={text => setDueText(text.replace(/\D/g, ''))}
            placeholder="For example 3; empty means no reminder"
            disabled={busy}
          />

          <FormButton
            buttonTitle={editing ? 'Update Card' : 'Add Card'}
            onPress={handleSave}
            loading={saving}
            disabled={busy}
          />
          {editing ? (
            <FormButton
              buttonTitle="Remove Card"
              onPress={confirmRemove}
              loading={removing}
              disabled={busy}
              style={{backgroundColor: colors.expense}}
            />
          ) : null}
        </FormCard>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default CardFormScreen;
