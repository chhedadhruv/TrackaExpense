import {cleanMerchant} from './common';
import type {BankHints} from './types';

/**
 * Axis Bank: "INR 500.00 debited A/c no. XX1234 15-11-26, 10:11:12 UPI/P2M/123456789012/SHOP",
 * "INR 25000.00 credited to A/c no. XX1234 01-11-26 ... from SENDER", "Spent Card no. XX1234 INR
 * 1250 15-11-26 10:11:12 AMAZON Avl Lmt INR ...".
 */
export const parseAxis = (body: string): BankHints => {
  const raw =
    /\bUPI\/P2[MP]\/\d+\/([A-Za-z0-9 &'-]+?)(?=\.|\s+(?:Not|SMS|If|Avl|Call)\b|\s*$)/i.exec(
      body,
    )?.[1] ??
    /\bfrom\s+(.+?)(?:\.|\s+Avl|\s*$)/i.exec(body)?.[1] ??
    /\d{1,2}[-/]\d{1,2}[-/]\d{2,4},?\s+\d{2}:\d{2}:\d{2}\s+(.+?)\s+Avl/i.exec(
      body,
    )?.[1];
  return {merchant: cleanMerchant(raw)};
};
