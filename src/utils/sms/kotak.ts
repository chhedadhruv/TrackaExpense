import {cleanMerchant} from './common';
import type {BankHints} from './types';

/**
 * Kotak Mahindra Bank: "Sent Rs.500.00 from Kotak Bank AC X1234 to shop@okaxis on 15-11-26.UPI Ref
 * 123456789012", "Received Rs.25000.00 in your Kotak Bank AC X1234 from sender@upi on 01-11-26",
 * "Your Kotak Bank AC X1234 is debited for Rs. 500 on 15-11-26 and credited to SHOP".
 */
export const parseKotak = (body: string): BankHints => {
  const raw =
    /\bto\s+(\S+@\S+?)\s+on\b/i.exec(body)?.[1] ??
    /\bfrom\s+(\S+@\S+?)\s+on\b/i.exec(body)?.[1] ??
    /\bcredited to\s+(.+?)(?:\.|\s+UPI|\s*$)/i.exec(body)?.[1] ??
    /\bat\s+(.+?)\s+on\s+\d/i.exec(body)?.[1] ??
    /\bto\s+([A-Za-z0-9 &.'-]+?)\s+on\s+\d/i.exec(body)?.[1] ??
    /\bfrom\s+([A-Za-z0-9 &.'-]+?)\s+on\s+\d/i.exec(body)?.[1];
  return {merchant: cleanMerchant(raw)};
};
