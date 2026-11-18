import type {ParsedSms} from './sms/types';

/**
 * From a parsed bank message to the Add Expense or Add Income form. The form is the confirmation
 * screen: a message only fills it in, and nothing is saved until the person taps the add button.
 */

export interface FormPrefill {
  title?: string;
  amount?: string;
  date?: string;
  description?: string;
}

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 200;

const METHOD_TITLES: Record<ParsedSms['method'], [string, string]> = {
  upi: ['UPI payment', 'UPI money received'],
  card: ['Card payment', 'Card refund'],
  atm: ['Cash withdrawal', 'Cash deposit'],
  transfer: ['Bank transfer', 'Bank transfer received'],
  other: ['Bank debit', 'Bank credit'],
};

/** A title for the form: the merchant when the message names one, else a plain description. */
export const titleFor = (parsed: ParsedSms): string =>
  (
    parsed.merchant ??
    METHOD_TITLES[parsed.method][parsed.direction === 'debit' ? 0 : 1]
  ).slice(0, MAX_TITLE);

export type ImportTarget = 'expense' | 'income';

export const targetFor = (parsed: ParsedSms): ImportTarget =>
  parsed.direction === 'debit' ? 'expense' : 'income';

/**
 * The form values for a parsed message, or null when the message is in another currency than the
 * person's own (nothing is converted, so they enter that one by hand).
 */
export const prefillFor = (
  parsed: ParsedSms,
  userCurrency: string,
): FormPrefill | null => {
  if (parsed.currency !== userCurrency) {
    return null;
  }
  const account = parsed.account ? ` (account ending ${parsed.account})` : '';
  return {
    title: titleFor(parsed),
    amount: parsed.amount,
    date: parsed.date,
    description: `From a bank message${account}`.slice(0, MAX_DESCRIPTION),
  };
};

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Reads the prefill back from route params (which are always text and can be anything a link or a
 * caller put there): only well-formed values are accepted, the rest is dropped.
 */
export const prefillFromParams = (
  params: Record<string, string | string[] | undefined>,
): FormPrefill => {
  const out: FormPrefill = {};
  const title = first(params.title)?.trim();
  if (title) {
    out.title = title.slice(0, MAX_TITLE);
  }
  const amount = first(params.amount)?.trim();
  if (amount && /^\d{1,12}(\.\d{1,4})?$/.test(amount)) {
    out.amount = amount;
  }
  const date = first(params.date)?.trim();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    out.date = date;
  }
  const description = first(params.description)?.trim();
  if (description) {
    out.description = description.slice(0, MAX_DESCRIPTION);
  }
  return out;
};

/** Route params for the add form; only the fields that have a value. */
export const prefillParams = (prefill: FormPrefill): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(prefill)) {
    if (typeof value === 'string' && value !== '') {
      out[key] = value;
    }
  }
  return out;
};
