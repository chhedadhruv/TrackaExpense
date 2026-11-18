import {cleanMerchant} from './common';
import type {BankHints} from './types';

/**
 * State Bank of India: "Dear UPI user A/C X1234 debited by 500.0 on date 15Nov26 trf to SHOP Refno
 * 123456789012", "Your A/C XXXXXXXX1234 has a credit transaction of Rs. 25,000.00 on 01/11/26",
 * "A/C X1234 credited by Rs 500 on 01Nov26 transfer from SENDER Ref No ...", "Rs.1250.00 spent on
 * your SBI Credit Card ending 1234 at AMAZON on 15-11-26".
 */
export const parseSbi = (body: string): BankHints => {
  const hints: BankHints = {};
  if (/credit transaction of/i.test(body)) {
    // "has a credit transaction" is a credit even though the word credited is absent.
    hints.direction = 'credit';
  }
  const raw =
    /\btrf to\s+(.+?)\s+Ref/i.exec(body)?.[1] ??
    /\btransfer from\s+(.+?)\s+Ref/i.exec(body)?.[1] ??
    /\bat\s+(.+?)\s+on\s+\d/i.exec(body)?.[1];
  hints.merchant = cleanMerchant(raw);
  return hints;
};
