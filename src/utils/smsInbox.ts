import {parseSms} from './sms/parse';
import type {ParsedSms} from './sms/types';

/**
 * Rules for the inbox reader (Android only). The phone hands over messages from named senders
 * only; everything here runs on the phone and nothing is sent anywhere. A message becomes an
 * "offer" only when it is a finished payment or deposit, and it is offered once.
 */

/** How far back the reader looks. */
export const LOOKBACK_DAYS = 30;
/** The most messages read from the inbox in one go. */
export const MAX_READ = 300;
/** The most handled message ids kept on the phone; the oldest are dropped first. */
export const MAX_HANDLED = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One message as the native module returns it. */
export interface RawSms {
  sender: string;
  body: string;
  /** Arrival time in milliseconds since the epoch. */
  date: number;
}

export interface SmsOffer {
  parsed: ParsedSms;
  sender: string;
  /** Arrival time in milliseconds since the epoch. */
  receivedAt: number;
}

/** The start of the look-back window. */
export const sinceFor = (now: number): number => now - LOOKBACK_DAYS * DAY_MS;

/**
 * A sender id from a bank or service is a short name ("VM-HDFCBK"), not a phone number. Messages
 * from people (digits, spaces, plus or dashes only) are never read, so the personal inbox stays
 * untouched. The native module applies the same rule before it returns anything.
 */
export const isNamedSender = (sender: string): boolean =>
  /[A-Za-z]/.test(sender);

/**
 * The messages worth offering: named senders, completed payments or deposits, not handled
 * before, newest first. A message that the parser skips (OTP, offer, due, failed) is dropped
 * silently and never shown.
 */
export const offersFrom = (
  messages: readonly RawSms[],
  handled: ReadonlySet<string>,
): SmsOffer[] => {
  const offers: SmsOffer[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    if (!isNamedSender(message.sender)) {
      continue;
    }
    const parsed = parseSms({
      sender: message.sender,
      body: message.body,
      receivedAt: new Date(message.date),
    });
    if (parsed === null || handled.has(parsed.id) || seen.has(parsed.id)) {
      continue;
    }
    seen.add(parsed.id);
    offers.push({parsed, sender: message.sender, receivedAt: message.date});
  }
  return offers.sort((a, b) => b.receivedAt - a.receivedAt);
};

/** Adds ids to the handled list (newest last) without repeats, keeping at most `MAX_HANDLED`. */
export const addHandled = (
  current: readonly string[],
  ids: readonly string[],
): string[] => {
  const merged = [...current.filter(id => !ids.includes(id)), ...ids];
  return merged.slice(-MAX_HANDLED);
};
