import moment from 'moment';
import {minorOf, type StoredMoney} from './amounts';
import {fromMinor} from './money';
import {shareOfMinor, isSettlementEntry, type SplitLike} from './splitMath';
import {sanitizeTags} from './tags';

/**
 * CSV for the export buttons (transactions and group splits). Pure, so it is tested with fixtures.
 *
 * Rules: RFC 4180 (comma separated, CRLF lines, a cell with a comma, quote or line break is
 * quoted and its quotes doubled); a UTF-8 byte order mark first so Excel reads non-ASCII text;
 * amounts are exact decimal text from integer minor units (no float noise, no currency symbol);
 * text cells that start with = + - @ tab or CR get a leading apostrophe so a spreadsheet never
 * runs them as a formula (CSV injection).
 */

export const CSV_BOM = '﻿';
const NEWLINE = '\r\n';
const FORMULA_START = /^[=+\-@\t\r]/;

/** One text cell, escaped. Use for any user-written text; numbers go through `rawCell`. */
export const textCell = (value: unknown): string => {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return rawCell(text);
};

/** A cell that is already safe text or a number: only the quoting rule applies. */
const rawCell = (text: string): string =>
  /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

const line = (cells: readonly string[]): string => cells.join(',');

const joinCsv = (header: readonly string[], rows: string[][]): string =>
  CSV_BOM + [header, ...rows].map(line).join(NEWLINE) + NEWLINE;

/** Exact decimal text of a stored amount; the legacy value as typed when it cannot be converted. */
export const amountText = (doc: StoredMoney, currencyCode: string): string => {
  const minor = minorOf(doc, currencyCode);
  if (minor !== null) {
    const docCurrency =
      typeof doc.currency === 'string' && doc.currency !== ''
        ? doc.currency
        : currencyCode;
    return fromMinor(minor, docCurrency);
  }
  const legacy = doc.amount;
  return typeof legacy === 'string' || typeof legacy === 'number'
    ? rawCell(String(legacy).trim())
    : '';
};

interface DateSource {
  toDate: () => Date;
}

/** A transaction's calendar day: its own `date` text when it is one, else the creation time. */
export const dayOf = (
  date: unknown,
  createdAt: DateSource | undefined | null,
): string => {
  const parts =
    typeof date === 'string'
      ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date)
      : null;
  if (parts) {
    const day = moment([
      Number(parts[1]),
      Number(parts[2]) - 1,
      Number(parts[3]),
    ]);
    if (day.isValid()) {
      return day.format('YYYY-MM-DD');
    }
  }
  if (date && typeof (date as DateSource).toDate === 'function') {
    return moment((date as DateSource).toDate()).format('YYYY-MM-DD');
  }
  return createdAt ? moment(createdAt.toDate()).format('YYYY-MM-DD') : '';
};

export interface ExportTransaction extends StoredMoney {
  title?: string;
  description?: string;
  type?: string;
  category?: string;
  date?: unknown;
  createdAt?: DateSource | null;
  tags?: unknown;
  cardId?: unknown;
}

export const TRANSACTION_HEADER = [
  'Date',
  'Title',
  'Type',
  'Category',
  'Amount',
  'Currency',
  'Tags',
  'Description',
  'Payment Method',
] as const;

export const CASH_LABEL = 'Cash / UPI';

/**
 * One row per transaction, in the order given. Tags are joined with "; ". "Payment Method" is the
 * card's name (from `cardNames`, by card id) or Cash / UPI; a card that is no longer known shows
 * as "Card".
 */
export const buildTransactionsCsv = (
  transactions: readonly ExportTransaction[],
  currencyCode: string,
  cardNames: Readonly<Record<string, string>> = {},
): string =>
  joinCsv(
    TRANSACTION_HEADER,
    transactions.map(t => [
      dayOf(t.date, t.createdAt),
      textCell(t.title),
      textCell(t.type),
      textCell(t.category),
      amountText(t, currencyCode),
      typeof t.currency === 'string' && t.currency !== ''
        ? textCell(t.currency)
        : textCell(currencyCode),
      textCell(sanitizeTags(t.tags).join('; ')),
      textCell(t.description),
      textCell(
        typeof t.cardId === 'string' && t.cardId !== ''
          ? cardNames[t.cardId] ?? 'Card'
          : CASH_LABEL,
      ),
    ]),
  );

export interface ExportSplit extends SplitLike {
  title?: string;
  category?: string;
  type?: string | null;
  isSettlement?: boolean | null;
  date?: unknown;
  createdAt?: DateSource | null;
  paidBy?: {name?: string; email?: string} | null;
}

export const SPLIT_HEADER = [
  'Date',
  'Title',
  'Paid By',
  'Category',
  'Amount',
  'Your Share',
  'Split Type',
  'Settlement',
] as const;

/**
 * One row per split entry. "Your Share" is the signed-in person's share in minor units (empty
 * for settlements and for splits they are not in).
 */
export const buildSplitsCsv = (
  splits: readonly ExportSplit[],
  currentEmail: string,
  currencyCode: string,
): string =>
  joinCsv(
    SPLIT_HEADER,
    splits.map(s => {
      const settlement = isSettlementEntry(s);
      const share = settlement
        ? null
        : shareOfMinor(s, currentEmail, currencyCode);
      return [
        dayOf(s.date, s.createdAt),
        textCell(s.title),
        textCell(s.paidBy?.name || s.paidBy?.email || ''),
        textCell(s.category),
        amountText(s, currencyCode),
        share === null ? '' : fromMinor(share, currencyCode),
        textCell(s.splitType || 'equal'),
        settlement ? 'Yes' : 'No',
      ];
    }),
  );

/** "transactions_2026-11-18_21-05-09.csv": no characters that a file system or share sheet dislikes. */
export const exportFileName = (
  prefix: string,
  now: Date = new Date(),
): string => {
  const safe = prefix.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safe || 'export'}_${moment(now).format('YYYY-MM-DD_HH-mm-ss')}.csv`;
};
