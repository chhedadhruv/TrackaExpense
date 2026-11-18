/**
 * Reads the text Cloud Vision found on a receipt photo and proposes the amount, the date and the
 * merchant. Pure, so it is tested with fixtures. It only proposes: the app fills the form for the
 * person to check and never saves anything on its own.
 */

export interface ReceiptGuess {
  /** Up to three candidate totals, best first, as exact decimal text ("1234.50"). */
  amounts: string[];
  /** YYYY-MM-DD, or null when no plausible date was found. */
  date: string | null;
  merchant: string | null;
}

const MAX_AMOUNT_MINOR = 1_000_000_000; // 10,000,000.00
const MAX_CANDIDATES = 3;
const FIVE_YEARS_DAYS = 5 * 366;
const DAY_MS = 86_400_000;

const STRONG_TOTAL =
  /\b(grand\s*total|total\s*amount|net\s*payable|amount\s*payable|amt\.?\s*payable|amount\s*due|balance\s*due|total\s*due|net\s*amount|bill\s*amount|total\s*payable)\b/i;
const PLAIN_TOTAL = /\btotal\b/i;
const NOT_A_TOTAL =
  /\b(sub\s*-?\s*total|tax|gst|cgst|sgst|igst|vat|discount|change|round(ing)?\s*off|saving|mrp|rate|price|qty|quantity|items?|points?|gstin|phone|tel|mobile|invoice|bill\s*no|order\s*(no|id)|ref|card\s*no)\b/i;
const PAID = /\b(paid|tendered|cash|card|upi|visa|master|net)\b/i;
const CURRENCY_MARK = /(₹|\bRs\b\.?|\bINR\b|\$|€|£|\bUSD\b|\bEUR\b)/i;

const NUMBER = /\d[\d,]*(?:\.\d{1,2})?/g;
const EUROPEAN = /\b\d{1,3}(?:\.\d{3})+,\d{2}\b/g;

/** "1,23,456.50" -> 12345650 minor units; null when it is not a usable amount. */
const toMinor = (raw: string): number | null => {
  const text = raw.replace(/,/g, '');
  const [whole, fraction = ''] = text.split('.');
  if (whole === '' || !/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) {
    return null;
  }
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_AMOUNT_MINOR
    ? minor
    : null;
};

const minorText = (minor: number): string =>
  `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;

const numbersIn = (line: string): {minor: number; hasDecimal: boolean}[] => {
  // "1.234,50" (European grouping) becomes "1234.50" before the general scan.
  const normalised = line.replace(EUROPEAN, m =>
    m.replace(/\./g, '').replace(',', '.'),
  );
  const out: {minor: number; hasDecimal: boolean}[] = [];
  for (const match of normalised.matchAll(NUMBER)) {
    const minor = toMinor(match[0]);
    if (minor !== null) {
      out.push({minor, hasDecimal: match[0].includes('.')});
    }
  }
  return out;
};

interface Candidate {
  minor: number;
  score: number;
}

/** Ranks the amounts on the receipt: totals first, then paid lines, then the largest figure. */
export const guessAmounts = (text: string): string[] => {
  const lines = text.split(/\r?\n/);
  const found: Candidate[] = [];
  let carry = 0;
  lines.forEach(line => {
    const nums = numbersIn(line);
    const blocked = NOT_A_TOTAL.test(line) && !STRONG_TOTAL.test(line);
    let keyword = 0;
    if (STRONG_TOTAL.test(line)) {
      keyword = 100;
    } else if (PLAIN_TOTAL.test(line) && !blocked) {
      keyword = 60;
    } else if (PAID.test(line) && !blocked) {
      keyword = 20;
    }
    if (nums.length === 0) {
      // "TOTAL" alone on a line: the figure is usually on the next one.
      carry = keyword >= 60 ? keyword - 10 : 0;
      return;
    }
    const base = keyword > 0 ? keyword : carry;
    carry = 0;
    for (const n of nums) {
      // A bare integer is only believable next to a total keyword or a currency mark.
      if (!n.hasDecimal && base === 0 && !CURRENCY_MARK.test(line)) {
        continue;
      }
      let score = base + (CURRENCY_MARK.test(line) ? 10 : 0);
      if (blocked) {
        score -= 50;
      }
      found.push({minor: n.minor, score});
    }
  });

  const best = new Map<number, number>();
  for (const c of found) {
    best.set(c.minor, Math.max(best.get(c.minor) ?? -Infinity, c.score));
  }
  return [...best.entries()]
    .filter(([, score]) => score > -50)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .slice(0, MAX_CANDIDATES)
    .map(([minor]) => minorText(minor));
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

const fullYear = (y: number): number => (y < 100 ? 2000 + y : y);

const validDate = (
  y: number,
  m: number,
  d: number,
  todayMs: number,
): string | null => {
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  if (ms > todayMs + DAY_MS || ms < todayMs - FIVE_YEARS_DAYS * DAY_MS) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
};

interface Match {
  index: number;
  date: string;
}

/**
 * The first plausible date in the text (not in the future, not older than five years). Numeric
 * dates are day first, as on Indian receipts, unless the second number cannot be a month.
 */
export const guessDate = (text: string, now: Date): string | null => {
  const todayMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const matches: Match[] = [];

  for (const m of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const d = validDate(Number(m[1]), Number(m[2]), Number(m[3]), todayMs);
    if (d) {
      matches.push({index: m.index ?? 0, date: d});
    }
  }
  for (const m of text.matchAll(
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g,
  )) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = fullYear(Number(m[3]));
    const d =
      validDate(y, b, a, todayMs) ??
      (b > 12 ? validDate(y, a, b, todayMs) : null);
    if (d) {
      matches.push({index: m.index ?? 0, date: d});
    }
  }
  for (const m of text.matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4}|\d{2})\b/g,
  )) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const d = month
      ? validDate(fullYear(Number(m[3])), month, Number(m[1]), todayMs)
      : null;
    if (d) {
      matches.push({index: m.index ?? 0, date: d});
    }
  }
  for (const m of text.matchAll(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g,
  )) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const d = month
      ? validDate(Number(m[3]), month, Number(m[2]), todayMs)
      : null;
    if (d) {
      matches.push({index: m.index ?? 0, date: d});
    }
  }
  matches.sort((a, b) => a.index - b.index);
  return matches[0]?.date ?? null;
};

const NOT_A_NAME =
  /\b(invoice|bill|receipt|tax|gst|gstin|tel|phone|mobile|date|time|www|http|email|cashier|table|order|customer|thank|welcome|copy|original|duplicate)\b|@|\.com\b/i;

/** The first of the top lines that looks like a shop name: letters, not mostly digits, no label words. */
export const guessMerchant = (text: string): string | null => {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l !== '')
    .slice(0, 6);
  for (const line of lines) {
    const letters = (line.match(/[A-Za-z]/g) ?? []).length;
    const digits = (line.match(/\d/g) ?? []).length;
    if (letters < 3 || digits > letters || NOT_A_NAME.test(line)) {
      continue;
    }
    return line.length > 50 ? line.slice(0, 50).trim() : line;
  }
  return null;
};

export const parseReceiptText = (
  text: string,
  now: Date = new Date(),
): ReceiptGuess => ({
  amounts: guessAmounts(text),
  date: guessDate(text, now),
  merchant: guessMerchant(text),
});
