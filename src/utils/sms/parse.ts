import {fromMinor, tryToMinor} from '../money';
import {parseAxis} from './axis';
import {
  accountOf,
  amountOf,
  dateOf,
  directionOf,
  isNotTransaction,
  methodOf,
  referenceOf,
} from './common';
import {parseHdfc} from './hdfc';
import {parseIcici} from './icici';
import {parseKotak} from './kotak';
import {parseSbi} from './sbi';
import type {BankHints, BankId, ParsedSms, SmsInput} from './types';

const PARSERS: Record<
  Exclude<BankId, 'generic'>,
  (body: string) => BankHints
> = {
  hdfc: parseHdfc,
  icici: parseIcici,
  sbi: parseSbi,
  axis: parseAxis,
  kotak: parseKotak,
};

/** The bank from the sender id ("VM-HDFCBK", "AX-SBIINB") or, failing that, the text. */
export const bankOf = (sender: string | undefined, body: string): BankId => {
  const id = (sender ?? '').toUpperCase();
  const text = body.toUpperCase();
  const tests: [BankId, RegExp][] = [
    ['hdfc', /HDFC/],
    ['icici', /ICICI/],
    ['sbi', /\bSBI|^SBI/],
    ['axis', /AXIS/],
    ['kotak', /KOTAK|KMBL/],
  ];
  for (const [bank, pattern] of tests) {
    if (pattern.test(id)) {
      return bank;
    }
  }
  for (const [bank, pattern] of tests) {
    if (pattern.test(text)) {
      return bank;
    }
  }
  return 'generic';
};

/** Small stable hash for the message id, so the same message is never offered twice. */
const hashText = (text: string): string => {
  let h = 7;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 131 + text.charCodeAt(i)) % 4_294_967_291;
  }
  return h.toString(36);
};

export const smsId = (input: SmsInput): string =>
  hashText(
    `${(input.sender ?? '').trim()}|${
      input.receivedAt?.getTime() ?? 0
    }|${input.body.trim()}`,
  );

const pad = (n: number): string => String(n).padStart(2, '0');

const dayOf = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Reads one bank SMS. Returns null for anything that is not a finished payment or deposit: OTPs,
 * promotions, dues and reminders, failed payments, balance messages, and text with no amount.
 * The bank is found from the sender or the text; the bank's own parser adds the merchant, and
 * the generic reading covers the rest, so an unknown bank still works when the wording is common.
 * A message with no date in it gets the day it arrived.
 */
export const parseSms = (input: SmsInput): ParsedSms | null => {
  const body = input.body.replace(/\s+/g, ' ').trim();
  if (body === '' || isNotTransaction(body)) {
    return null;
  }
  const bank = bankOf(input.sender, body);
  const hints = bank === 'generic' ? {} : PARSERS[bank](body);
  const direction = hints.direction ?? directionOf(body);
  const amount = amountOf(body);
  if (direction === null || amount === null) {
    return null;
  }
  const minor = tryToMinor(amount.text, amount.currency);
  if (minor === null || minor <= 0) {
    return null;
  }
  const date =
    dateOf(body) ?? (input.receivedAt ? dayOf(input.receivedAt) : null);
  if (date === null) {
    return null;
  }
  return {
    id: smsId(input),
    bank,
    direction,
    currency: amount.currency,
    amountMinor: minor,
    amount: fromMinor(minor, amount.currency),
    merchant: hints.merchant ?? null,
    account: hints.account ?? accountOf(body),
    date,
    method: methodOf(body),
    reference: referenceOf(body),
  };
};
