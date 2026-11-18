/**
 * What the app does with a receipt scan result. The server only proposes (see
 * functions/src/receiptParse.ts); these rules decide which form fields a proposal may fill. A scan
 * never saves anything: the person reviews the form and taps Add Expense themselves.
 */

export interface ReceiptGuess {
  /** Candidate totals, best first, as exact decimal text. */
  amounts: string[];
  /** YYYY-MM-DD or null. */
  date: string | null;
  merchant: string | null;
}

export interface ScanFormValues {
  title: string;
  amount: string;
  date: string;
}

export interface ScanFill {
  title?: string;
  amount?: string;
  date?: string;
  /** The other candidate totals the person can tap if the first one is wrong. */
  alternatives: string[];
  /** Which fields were filled, for the note under the receipt ("amount", "date", "title"). */
  filled: string[];
  /** True when the scan found nothing usable at all. */
  empty: boolean;
}

const MAX_TITLE = 100;

/**
 * Fills the title and the amount only when they are still empty (a scan never overwrites what the
 * person typed), and the date whenever the receipt has one (the date field starts as today, so it
 * cannot be told apart from a deliberate choice, and the receipt's own date is the point of a scan).
 */
export const applyGuess = (
  guess: ReceiptGuess,
  current: ScanFormValues,
): ScanFill => {
  const fill: ScanFill = {alternatives: [], filled: [], empty: false};
  const [best, ...others] = guess.amounts;
  if (best !== undefined && current.amount.trim() === '') {
    fill.amount = best;
    fill.filled.push('amount');
    fill.alternatives = others;
  } else if (best !== undefined) {
    // The amount was typed already: offer every candidate that differs from it.
    fill.alternatives = guess.amounts.filter(a => a !== current.amount.trim());
  }
  if (guess.merchant && current.title.trim() === '') {
    fill.title = guess.merchant.slice(0, MAX_TITLE);
    fill.filled.push('title');
  }
  if (guess.date && guess.date !== current.date) {
    fill.date = guess.date;
    fill.filled.push('date');
  }
  fill.empty = guess.amounts.length === 0 && !guess.date && !guess.merchant;
  return fill;
};

/** A readable message for a failed scan; the server's own text is used where it is meant for people. */
export const scanErrorMessage = (error: unknown): string => {
  const code =
    typeof error === 'object' && error !== null
      ? String((error as {code?: unknown}).code ?? '')
      : '';
  const message =
    typeof error === 'object' && error !== null
      ? String((error as {message?: unknown}).message ?? '')
      : '';
  const readable = [
    'resource-exhausted',
    'failed-precondition',
    'permission-denied',
    'unavailable',
  ].some(c => code.endsWith(c));
  if (readable && message !== '') {
    // The native module prefixes the code, e.g. "[functions/resource-exhausted] ...".
    return message.replace(/^\[[^\]]*\]\s*/, '');
  }
  return 'The receipt could not be scanned. Enter it by hand.';
};
