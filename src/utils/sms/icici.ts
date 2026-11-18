import {cleanMerchant} from './common';
import type {BankHints} from './types';

/**
 * ICICI Bank: "ICICI Bank Acct XX123 debited for Rs 500.00 on 15-Nov-26; SHOP credited. UPI:...",
 * "ICICI Bank Acct XX123 credited with Rs. 25,000.00 on 01-Nov-26. Info: NEFT-ACME LTD. Available
 * Bal ...", "INR 1,250.00 spent on ICICI Bank Card XX1234 on 15-Nov-26 at AMAZON. Avl Limit ...".
 * In the first form the word "credited" belongs to the shop, so the first verb still gives debit.
 */
export const parseIcici = (body: string): BankHints => {
  const raw =
    /;\s*([A-Za-z0-9 &.'@-]+?)\s+credited/i.exec(body)?.[1] ??
    /\bInfo:\s*(?:NEFT-|IMPS-|UPI-)?([A-Za-z0-9 &.'-]+?)(?:\.|-|\s*$)/i.exec(
      body,
    )?.[1] ??
    /\bat\s+([A-Za-z0-9 &.'*-]+?)(?:\.|\s+Avl)/i.exec(body)?.[1] ??
    /\bfrom\s+([A-Za-z0-9 &.'@-]+?)(?:\.|\s+on\b)/i.exec(body)?.[1];
  return {merchant: cleanMerchant(raw)};
};
