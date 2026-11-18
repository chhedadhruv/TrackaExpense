export type BankId = 'hdfc' | 'icici' | 'sbi' | 'axis' | 'kotak' | 'generic';
export type Direction = 'debit' | 'credit';
export type PaymentMethod = 'upi' | 'card' | 'atm' | 'transfer' | 'other';

/** One bank message as read from the phone or pasted by the person. */
export interface SmsInput {
  /** The sender id, such as "VM-HDFCBK"; empty for a pasted message. */
  sender?: string;
  body: string;
  /** When the message arrived; used for the date when the text carries none. */
  receivedAt?: Date;
}

/** What a bank message says. Only a proposal: the person confirms it before anything is saved. */
export interface ParsedSms {
  /** Stable id of this message (sender, body and arrival time), used to not offer it twice. */
  id: string;
  bank: BankId;
  direction: Direction;
  currency: string;
  /** Integer minor units, exact. */
  amountMinor: number;
  /** Exact decimal text of the amount ("1250.00"). */
  amount: string;
  /** Who was paid or who paid; null when the message does not say. */
  merchant: string | null;
  /** The last digits of the account or card. */
  account: string | null;
  /** YYYY-MM-DD. */
  date: string;
  method: PaymentMethod;
  /** Bank or UPI reference number. */
  reference: string | null;
}

/** What a bank-specific parser may override on top of the generic reading. */
export interface BankHints {
  merchant?: string | null;
  direction?: Direction;
  account?: string | null;
}
