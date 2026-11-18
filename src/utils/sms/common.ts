import type {Direction, PaymentMethod} from './types';

/** Messages that are never a transaction, however they are worded. */
const NOT_A_TRANSACTION =
  /\botp\b|one[- ]time password|verification code|do not share|never share|will be debited|is due|due (on|by|date)|min(imum)?\.? (amount )?due|total (amount )?due|e-?mandate|auto-?pay|standing instruction|requested money|collect request|payment request|has requested|failed|declined|unsuccessful|insufficient|not (been )?processed|reversal pending|pre-?approved|apply now|click here to (apply|avail)|congratulations|eligible for/i;

const DEBIT_WORDS =
  /\b(debited|spent|sent|paid|withdrawn|purchase|payment of)\b/i;
const CREDIT_WORDS = /\b(credited|received|deposited|refund(ed)?)\b/i;

/** "Credit Card" and "credit limit" are not credits. */
const withoutCreditNoise = (text: string): string =>
  text.replace(/credit\s+(card|limit)|avl\.?\s*(credit\s*)?limit/gi, ' ');

/** True for OTPs, promotions, dues, failed payments and anything else that is not a done transaction. */
export const isNotTransaction = (body: string): boolean =>
  NOT_A_TRANSACTION.test(body);

/** Debit or credit by whichever verb comes first, or null when neither appears. */
export const directionOf = (body: string): Direction | null => {
  const text = withoutCreditNoise(body);
  const debit = text.search(DEBIT_WORDS);
  const credit = text.search(CREDIT_WORDS);
  if (debit === -1 && credit === -1) {
    return null;
  }
  if (credit === -1 || (debit !== -1 && debit < credit)) {
    return 'debit';
  }
  return 'credit';
};

const CURRENCY_TOKEN = /(Rs\.?|INR|₹|USD|\$|EUR|€|GBP|£|AED|SGD)/i;
const AMOUNT_AFTER_TOKEN = new RegExp(
  `${CURRENCY_TOKEN.source}\\s*([\\d,]+(?:\\.\\d{1,2})?)`,
  'gi',
);
const BALANCE_BEFORE = /(bal(ance)?|limit|avl|avail(able)?|outstanding)\W*$/i;

const CURRENCY_CODES: Record<string, string> = {
  rs: 'INR',
  'rs.': 'INR',
  inr: 'INR',
  '₹': 'INR',
  usd: 'USD',
  $: 'USD',
  eur: 'EUR',
  '€': 'EUR',
  gbp: 'GBP',
  '£': 'GBP',
  aed: 'AED',
  sgd: 'SGD',
};

export interface AmountReading {
  currency: string;
  /** Decimal text without commas, as written ("1250" or "1250.50"). */
  text: string;
}

/**
 * The first amount that is not a balance or limit. Looks for a currency marker first ("Rs.500",
 * "INR 1,250.00"), then for the bare number after "debited by" that some banks use.
 */
export const amountOf = (body: string): AmountReading | null => {
  for (const match of body.matchAll(AMOUNT_AFTER_TOKEN)) {
    const before = body.slice(
      Math.max(0, (match.index ?? 0) - 25),
      match.index,
    );
    if (BALANCE_BEFORE.test(before)) {
      continue;
    }
    const code = CURRENCY_CODES[match[1].toLowerCase()];
    return {currency: code ?? 'INR', text: match[2].replace(/,/g, '')};
  }
  const bare =
    /\b(?:debited|credited|spent|sent|received|withdrawn|deposited)\s+(?:by\s+|for\s+|of\s+|with\s+)?([\d,]+\.\d{1,2}|[\d,]{2,})\b/i.exec(
      body,
    );
  return bare ? {currency: 'INR', text: bare[1].replace(/,/g, '')} : null;
};

/** The last 3 or 4 digits of an account or card ("A/c XX1234", "Card ending 1234"). */
export const accountOf = (body: string): string | null => {
  const match =
    /(?:a\/c|\bac\b|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s+in)?|ending with))?\s*[:-]?\s*[Xx*]*\s*(\d{3,4})\b/i.exec(
      body,
    );
  return match ? match[1] : null;
};

export const referenceOf = (body: string): string | null => {
  const match =
    /(?:ref(?:erence)?(?:\s*no\.?)?|utr|rrn|upi(?:\s*ref(?:\s*no\.?)?)?)\s*[:.\-/]?\s*(\d{9,16})\b/i.exec(
      body,
    ) ?? /\bUPI\/(?:P2[MP]\/)?(\d{9,16})/i.exec(body);
  return match ? match[1] : null;
};

export const methodOf = (body: string): PaymentMethod => {
  if (/\bUPI\b|\bVPA\b|[\w.-]+@[a-z]{2,}/i.test(body)) {
    return 'upi';
  }
  if (/\batm\b|cash withdrawal/i.test(body)) {
    return 'atm';
  }
  if (/\bcard\b/i.test(body)) {
    return 'card';
  }
  if (/\b(neft|imps|rtgs)\b/i.test(body)) {
    return 'transfer';
  }
  return 'other';
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const pad = (n: number): string => String(n).padStart(2, '0');

const calendarDate = (y: number, m: number, d: number): string | null => {
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y &&
    check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : null;
};

const fullYear = (y: number): number => (y < 100 ? 2000 + y : y);

/**
 * The transaction date written in the text: 15-11-26, 15/11/2026, 15-Nov-26, 15Nov26 or
 * 2026-11-15. Numeric dates are day first. Null when none is found.
 */
export const dateOf = (body: string): string | null => {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(body);
  if (iso) {
    return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const named =
    /\b(\d{1,2})[-\s]?([A-Za-z]{3})[a-z]*[-\s]?(\d{4}|\d{2})\b/.exec(body);
  if (named && MONTHS[named[2].toLowerCase()]) {
    return calendarDate(
      fullYear(Number(named[3])),
      MONTHS[named[2].toLowerCase()],
      Number(named[1]),
    );
  }
  const numeric = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})\b/.exec(body);
  if (numeric) {
    return calendarDate(
      fullYear(Number(numeric[3])),
      Number(numeric[2]),
      Number(numeric[1]),
    );
  }
  return null;
};

/**
 * Turns the raw name a message gives ("MERCHANT", "shop.name@okhdfc", "VPA x@upi") into text for a
 * title, or null when it is only digits or too short to mean anything.
 */
export const cleanMerchant = (
  raw: string | null | undefined,
): string | null => {
  if (!raw) {
    return null;
  }
  let text = raw
    .replace(/^VPA\s+/i, '')
    .replace(/[.,;:\s]+$/g, '')
    .trim();
  if (text.includes('@')) {
    text = text
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .trim();
  }
  text = text.replace(/\s+/g, ' ');
  if (text.length < 2 || /^[\d\s*xX-]+$/.test(text)) {
    return null;
  }
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (
    letters.length >= 3 &&
    (letters === letters.toUpperCase() || letters === letters.toLowerCase())
  ) {
    text = text.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  }
  return text.length > 50 ? text.slice(0, 50).trim() : text;
};
