import {cleanMerchant} from './common';
import type {BankHints} from './types';

/**
 * HDFC Bank: "Rs.500.00 debited from a/c **1234 on 15-11-26 to VPA shop@okhdfc (UPI Ref No ...)",
 * "Sent Rs.500.00 From HDFC Bank A/C *1234 To SHOP On 15/11/26", "Spent Rs.1250 On HDFC Bank Card
 * 1234 At AMAZON On 2026-11-15", "Rs. 25000.00 credited to HDFC Bank A/c XX1234 on 01-11-26 by
 * A/c linked to VPA x@upi", "INR 25,000.00 deposited in HDFC Bank A/c XX1234 on 01NOV26 for NEFT
 * Cr-HDFC0001234-ACME LTD-...".
 */
export const parseHdfc = (body: string): BankHints => {
  const raw =
    /\bto VPA\s+(\S+)/i.exec(body)?.[1] ??
    /\bby (?:A\/c linked to )?VPA\s+(\S+)/i.exec(body)?.[1] ??
    /\bCr-[A-Z0-9]+-([A-Za-z0-9 &.]+?)(?:-|\.|\s*$)/.exec(body)?.[1] ??
    /\bTo\s+([A-Za-z0-9 &.'*-]+?)\s+On\s+\d/i.exec(body)?.[1] ??
    /\bAt\s+([A-Za-z0-9 &.'*-]+?)\s+On\s+\d/i.exec(body)?.[1] ??
    /\bfrom\s+([A-Za-z0-9 &.'*-]+?)\s+on\s+\d/i.exec(body)?.[1];
  return {merchant: cleanMerchant(raw)};
};
