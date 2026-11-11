import {minorOf, totalMajor, type StoredMoney} from './amounts';
import {allocateMinor} from './money';

/**
 * How a split is divided, in integer minor units. One place for the rule that several screens
 * used to repeat with float arithmetic (group balances, friend balances, split detail, export).
 *
 * The shares always add up to the total exactly; where a total cannot be divided evenly the first
 * participants get the extra minor unit (largest remainder method).
 */

export interface SplitParticipant {
  email?: string | null;
  percentage?: number | null;
}

export interface SplitLike extends StoredMoney {
  splitType?: string | null;
  splitUsers?: readonly SplitParticipant[] | null;
}

/**
 * Each participant's share in minor units, aligned with `splitUsers` (index for index).
 * Equal split unless `splitType` is 'percentage'. Returns null when the total cannot be
 * converted, and an empty array when there are no participants. Percentages that are all zero
 * give every participant a zero share (as the old float math did).
 */
export const sharesMinor = (
  split: SplitLike,
  currencyCode: string,
): number[] | null => {
  const total = minorOf(split, currencyCode);
  if (total === null) {
    return null;
  }
  const users = split.splitUsers ?? [];
  if (users.length === 0) {
    return [];
  }
  const weights =
    split.splitType === 'percentage'
      ? users.map(user => Math.max(0, Number(user.percentage ?? 0) || 0))
      : users.map(() => 1);
  if (weights.every(weight => weight === 0)) {
    return users.map(() => 0);
  }
  return allocateMinor(total, weights);
};

/** One participant's share (by email, case-insensitive) or null if they are not in the split. */
export const shareOfMinor = (
  split: SplitLike,
  email: string | null | undefined,
  currencyCode: string,
): number | null => {
  if (!email) {
    return null;
  }
  const wanted = email.toLowerCase();
  const users = split.splitUsers ?? [];
  const index = users.findIndex(user => user.email?.toLowerCase() === wanted);
  if (index === -1) {
    return null;
  }
  const shares = sharesMinor(split, currencyCode);
  return shares === null ? null : shares[index];
};

/** A settlement entry in the splits list (money moved between two people, not an expense). */
export const isSettlementEntry = (split: {
  type?: string | null;
  isSettlement?: boolean | null;
}): boolean => split.type === 'settlement' || split.isSettlement === true;

/** Total spent by the group: expenses only, settlement entries are left out. */
export const totalSpentMajor = <
  T extends StoredMoney & {type?: string | null; isSettlement?: boolean | null},
>(
  splits: readonly T[],
  currencyCode: string,
): number =>
  totalMajor(
    splits.filter(split => !isSettlementEntry(split)),
    currencyCode,
  );
