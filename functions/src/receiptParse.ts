/**
 * Reads the text Cloud Vision found on a receipt photo and proposes the amount, the date and the
 * merchant. Pure, so it is tested with fixtures. It only proposes: the app fills the form for the
 * person to check and never saves anything on its own.
 */

export interface ReceiptGuess {
  /**
   * Up to three candidate totals, best first, as exact decimal text: "1234.50", or "1234" for a
   * zero-decimal currency (JPY, KRW).
   */
  amounts: string[];
  /** YYYY-MM-DD, or null when no plausible date was found. */
  date: string | null;
  merchant: string | null;
}

/** Largest total proposed, in whole units of the currency (10,000,000). */
const MAX_AMOUNT_MAJOR = 10_000_000;
/** Decimal places of the usual minor unit; zero-decimal currencies (JPY, KRW) pass 0. */
const DEFAULT_EXPONENT = 2;
const MAX_CANDIDATES = 3;
const FIVE_YEARS_DAYS = 5 * 366;
const DAY_MS = 86_400_000;

const STRONG_TOTAL =
  /\b(grand\s*total|total\s*amount|net\s*payable|amount\s*payable|amt\.?\s*payable|amount\s*due|balance\s*due|total\s*due|net\s*amount|bill\s*amount|total\s*payable)\b/i;
const PLAIN_TOTAL = /\btotal\b/i;
const NOT_A_TOTAL =
  /\b(sub\s*-?\s*total|tax|gst|cgst|sgst|igst|vat|discount|change|round(ing)?\s*off|saving|mrp|rate|price|qty|quantity|items?|points?|gstin|phone|tel|mobile|invoice|bill\s*no|order\s*(no|id)|ref|card\s*no)\b/i;
const PAID = /\b(paid|tendered|cash|card|upi|visa|master|net)\b/i;
const CURRENCY_MARK =
  /(₹|\bRs\b\.?|\bINR\b|\$|€|£|\bUSD\b|\bEUR\b|¥|￥|₩|円|원|\bJPY\b|\bKRW\b)/i;

// Japanese and Korean receipts (the zero-decimal currencies the app supports). The words have no
// \b boundaries because those scripts are not word characters. Tax words are listed as whole
// words only (消費税, not 税) so a total such as "合計(税込)" is not read as a tax line.
const STRONG_TOTAL_CJK =
  /(総合計|合計金額|税込合計|ご請求額|お会計|お支払い?金額|합계금액|총\s*금액|총액|결제\s*금액|받을\s*금액)/;
const PLAIN_TOTAL_CJK = /(合計|합계)/;
const NOT_A_TOTAL_CJK =
  /(小計|소계|消費税|内税|外税|부가세|세금|공급가액|お釣り?|おつり|釣銭|거스름돈|割引|할인|ポイント|포인트)/;
const PAID_CJK =
  /(お預り|お預かり|現金|クレジット|お支払|현금|카드|받은\s*금액)/;

const isStrongTotal = (line: string): boolean =>
  STRONG_TOTAL.test(line) || STRONG_TOTAL_CJK.test(line);
const isPlainTotal = (line: string): boolean =>
  PLAIN_TOTAL.test(line) || PLAIN_TOTAL_CJK.test(line);
const isNotATotal = (line: string): boolean =>
  NOT_A_TOTAL.test(line) || NOT_A_TOTAL_CJK.test(line);
const isPaidLine = (line: string): boolean =>
  PAID.test(line) || PAID_CJK.test(line);

/**
 * A number in a line. Two decimals (or `exponent`) at most; a zero-decimal currency reads any
 * fraction so it can be rejected (see toMinor) instead of being cut into two separate numbers.
 */
const numberPattern = (exponent: number): RegExp =>
  exponent === 0
    ? /\d[\d,]*(?:\.\d+)?/g
    : new RegExp(`\\d[\\d,]*(?:\\.\\d{1,${exponent}})?`, 'g');
const EUROPEAN = /\b\d{1,3}(?:\.\d{3})+,\d{2}\b/g;

/**
 * "1,23,456.50" -> 12345650 minor units (exponent 2); null when it is not a usable amount. For a
 * zero-decimal currency ("1,234" -> 1234) a figure with a real fraction ("8.5", a tax rate or a
 * date part) is not an amount; "1234.00" is accepted as 1234.
 */
const toMinor = (raw: string, exponent: number): number | null => {
  const text = raw.replace(/,/g, '');
  const [whole, fraction = ''] = text.split('.');
  if (whole === '' || !/^\d+$/.test(whole)) {
    return null;
  }
  let minor: number;
  if (exponent === 0) {
    if (!/^0*$/.test(fraction)) {
      return null;
    }
    minor = Number(whole);
  } else {
    if (!new RegExp(`^\\d{0,${exponent}}$`).test(fraction)) {
      return null;
    }
    minor =
      Number(whole) * 10 ** exponent + Number(fraction.padEnd(exponent, '0'));
  }
  return Number.isSafeInteger(minor) &&
    minor > 0 &&
    minor <= MAX_AMOUNT_MAJOR * 10 ** exponent
    ? minor
    : null;
};

/** Exact decimal text: 119700 -> "1197.00" (exponent 2), 1197 -> "1197" (exponent 0). */
const minorText = (minor: number, exponent: number): string => {
  if (exponent === 0) {
    return String(minor);
  }
  const scale = 10 ** exponent;
  return `${Math.floor(minor / scale)}.${String(minor % scale).padStart(
    exponent,
    '0',
  )}`;
};

const numbersIn = (
  line: string,
  exponent: number,
): {minor: number; hasDecimal: boolean}[] => {
  // "1.234,50" (European grouping) becomes "1234.50" before the general scan.
  const normalised =
    exponent === 2
      ? line.replace(EUROPEAN, m => m.replace(/\./g, '').replace(',', '.'))
      : line;
  const out: {minor: number; hasDecimal: boolean}[] = [];
  for (const match of normalised.matchAll(numberPattern(exponent))) {
    const minor = toMinor(match[0], exponent);
    if (minor !== null) {
      // A decimal point makes a figure believable on its own (prices have decimals). With no
      // decimals in the currency, "10.0" (a tax rate) is no more an amount than a bare "10".
      out.push({minor, hasDecimal: exponent > 0 && match[0].includes('.')});
    }
  }
  return out;
};

interface Candidate {
  minor: number;
  score: number;
}

/**
 * Ranks the amounts on the receipt: totals first, then paid lines, then the largest figure.
 * `exponent` is the number of decimal places of the person's currency (0 for JPY and KRW); the
 * amounts come back as exact text with that many decimals.
 */
export const guessAmounts = (
  text: string,
  exponent: number = DEFAULT_EXPONENT,
): string[] => {
  const lines = text.split(/\r?\n/);
  const found: Candidate[] = [];
  let carry = 0;
  lines.forEach(line => {
    const nums = numbersIn(line, exponent);
    const blocked = isNotATotal(line) && !isStrongTotal(line);
    let keyword = 0;
    if (isStrongTotal(line)) {
      keyword = 100;
    } else if (isPlainTotal(line) && !blocked) {
      keyword = 60;
    } else if (isPaidLine(line) && !blocked) {
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
    .map(([minor]) => minorText(minor, exponent));
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
  // Japanese and Korean: 2026年11月14日, 2026년 11월 14일.
  for (const m of text.matchAll(
    /(\d{4})\s*[年년]\s*(\d{1,2})\s*[月월]\s*(\d{1,2})\s*[日일]/g,
  )) {
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
  exponent: number = DEFAULT_EXPONENT,
): ReceiptGuess => ({
  amounts: guessAmounts(text, exponent),
  date: guessDate(text, now),
  merchant: guessMerchant(text),
});
