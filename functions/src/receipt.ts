import type {Firestore} from 'firebase-admin/firestore';
import {getCurrencyExponent} from './money';
import {parseReceiptText, type ReceiptGuess} from './receiptParse';

/**
 * Receipt scanning: the app uploads a photo to its own `bills/{uid}/` folder (as it already does
 * for a receipt), then asks this function to read it. The function checks that the file is the
 * caller's own image, spends one unit of a per-person daily allowance and of a monthly allowance
 * for the whole app (the cost ceiling), runs text detection and returns only proposals (amount
 * candidates, date, merchant). It never saves a transaction and keeps no text.
 */

export class ReceiptScanError extends Error {
  constructor(
    readonly code:
      | 'invalid-argument'
      | 'permission-denied'
      | 'not-found'
      | 'resource-exhausted'
      | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

/** Scans one person may start in 24 hours. */
export const DAILY_LIMIT_PER_USER = 20;
/**
 * Scans for the whole app in a calendar month (UTC). Cloud Vision's free tier is 1,000 a month;
 * this stays under it, so the feature cannot start costing money unnoticed.
 */
export const MONTHLY_LIMIT_ALL = 900;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DAY_MS = 86_400_000;
const MAX_NAME = 200;

export interface ImageInfo {
  size: number;
  contentType: string;
}

export interface ScanDeps {
  db: Firestore;
  /** Size and type of the stored file, or null when it does not exist. */
  statImage(path: string): Promise<ImageInfo | null>;
  readImage(path: string): Promise<Buffer>;
  /** Text found in the image ('' when there is none). */
  recognize(image: Buffer): Promise<string>;
  now?: () => number;
}

/** The caller's own receipt path: bills/{uid}/{file}, one level, no path tricks. */
export const checkPath = (uid: string, input: unknown): string => {
  const path =
    typeof input === 'object' && input !== null
      ? (input as {storagePath?: unknown}).storagePath
      : undefined;
  if (typeof path !== 'string') {
    throw new ReceiptScanError('invalid-argument', 'storagePath is required.');
  }
  const prefix = `bills/${uid}/`;
  const name = path.startsWith(prefix) ? path.slice(prefix.length) : '';
  if (
    name === '' ||
    name.length > MAX_NAME ||
    name.includes('/') ||
    name.includes('..') ||
    name.includes('\0')
  ) {
    throw new ReceiptScanError(
      'permission-denied',
      'That file is not one of your receipts.',
    );
  }
  return path;
};

/**
 * Decimal places of the amounts to look for, from the optional `currency` the app sends (the
 * person's own currency). A missing or malformed value means 2, as before the field existed, so
 * old app versions are unchanged.
 */
export const exponentOf = (input: unknown): number => {
  const currency =
    typeof input === 'object' && input !== null
      ? (input as {currency?: unknown}).currency
      : undefined;
  return typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency)
    ? getCurrencyExponent(currency)
    : 2;
};

const monthKey = (nowMs: number): string =>
  new Date(nowMs).toISOString().slice(0, 7);

/** Takes one scan from the person's daily allowance and the app's monthly one, or throws. */
const takeAllowance = async (
  db: Firestore,
  uid: string,
  nowMs: number,
): Promise<void> => {
  const userRef = db.collection('scanLimits').doc(uid);
  const monthRef = db.collection('scanLimits').doc(`_month_${monthKey(nowMs)}`);
  await db.runTransaction(async t => {
    const [user, month] = await Promise.all([t.get(userRef), t.get(monthRef)]);
    const monthCount = month.exists ? Number(month.get('count')) || 0 : 0;
    if (monthCount >= MONTHLY_LIMIT_ALL) {
      throw new ReceiptScanError(
        'resource-exhausted',
        'Receipt scanning is paused until next month.',
      );
    }
    const start = user.exists ? Number(user.get('windowStart')) : 0;
    const count = user.exists ? Number(user.get('count')) || 0 : 0;
    const fresh = !Number.isFinite(start) || nowMs - start >= DAY_MS;
    if (!fresh && count >= DAILY_LIMIT_PER_USER) {
      throw new ReceiptScanError(
        'resource-exhausted',
        'You have scanned the most receipts allowed for today. Enter this one by hand.',
      );
    }
    t.set(
      userRef,
      fresh
        ? {windowStart: nowMs, count: 1}
        : {windowStart: start, count: count + 1},
    );
    t.set(monthRef, {count: monthCount + 1});
  });
};

export const scanReceipt = async (
  deps: ScanDeps,
  uid: string,
  input: unknown,
): Promise<ReceiptGuess> => {
  const nowMs = (deps.now ?? Date.now)();
  const path = checkPath(uid, input);
  const info = await deps.statImage(path);
  if (info === null) {
    throw new ReceiptScanError('not-found', 'The photo was not found.');
  }
  if (!info.contentType.startsWith('image/') || info.size > MAX_IMAGE_BYTES) {
    throw new ReceiptScanError(
      'invalid-argument',
      'The file must be an image under 10 MB.',
    );
  }
  await takeAllowance(deps.db, uid, nowMs);
  let text: string;
  try {
    text = await deps.recognize(await deps.readImage(path));
  } catch {
    throw new ReceiptScanError(
      'unavailable',
      'The receipt could not be read right now. Enter it by hand.',
    );
  }
  return parseReceiptText(text, new Date(nowMs), exponentOf(input));
};
