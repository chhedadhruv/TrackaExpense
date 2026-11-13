import {minorOf} from './amounts';
import {sharesMinor, type SplitLike} from './splitMath';
import {toMajorNumber} from './money';

/**
 * Who owes whom in a group, from its splits and settlements. Used by the group screen (the balance
 * list) and by settle-up (its suggestions), so both show the same figures.
 */

export interface LendingSplit extends SplitLike {
  type?: string;
  isSettlement?: boolean;
  paidBy?: {email?: string; name?: string};
  splitUsers?: Array<{email?: string; name?: string; percentage?: number}>;
}

export interface LendingDetail {
  lender: {email: string; name: string};
  borrower: {email: string; name: string};
  amount: number;
}

/** Emails are compared without regard to case or surrounding spaces. */
export const sameEmail = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

const PAIR_SEPARATOR = '|';

export const calculateNetLendingBalances = (
  splitsArr: readonly LendingSplit[],
  currencyCode: string,
): LendingDetail[] => {
  // One signed total per pair of people, in integer minor units, keyed by the two lowercased
  // emails in alphabetical order: positive means the second one owes the first.
  const pairs = new Map<string, number>();
  const names = new Map<string, string>();

  const remember = (person?: {email?: string; name?: string}): void => {
    const email = person?.email?.trim().toLowerCase();
    const name = person?.name?.trim();
    if (email && name && !names.has(email)) {
      names.set(email, name);
    }
  };
  const nameOf = (email: string): string =>
    names.get(email) ?? email.split('@')[0];

  /** `borrower` owes `lender` this much more (negative: less). */
  const addDebt = (lender: string, borrower: string, minor: number): void => {
    const lenderFirst = lender < borrower;
    const key = lenderFirst
      ? `${lender}${PAIR_SEPARATOR}${borrower}`
      : `${borrower}${PAIR_SEPARATOR}${lender}`;
    pairs.set(key, (pairs.get(key) ?? 0) + (lenderFirst ? minor : -minor));
  };

  splitsArr.forEach(split => {
    const paidByEmail = split.paidBy?.email?.trim().toLowerCase();
    const splitUsers = split.splitUsers || [];
    remember(split.paidBy);
    splitUsers.forEach(remember);

    // A settlement is an entry in the splits list: the borrower (paidBy) paid the lender (the
    // first splitUsers entry), so the borrower owes the lender that much less.
    if (split.type === 'settlement' || split.isSettlement) {
      const toEmail = splitUsers[0]?.email?.trim().toLowerCase();
      const amt = minorOf(split, currencyCode);
      if (!paidByEmail || !toEmail || paidByEmail === toEmail || amt === null) {
        return;
      }
      addDebt(toEmail, paidByEmail, -amt);
      return;
    }

    // Integer minor units: the shares of a split always add up to its total.
    const shares = sharesMinor(split, currencyCode);
    if (!paidByEmail || shares === null) {
      return;
    }
    splitUsers.forEach((u, index) => {
      const uEmail = u.email?.trim().toLowerCase();
      if (!uEmail || uEmail === paidByEmail) {
        return;
      }
      addDebt(paidByEmail, uEmail, shares[index]);
    });
  });

  const result: LendingDetail[] = [];
  pairs.forEach((net, key) => {
    if (net === 0) {
      return;
    }
    const [first, second] = key.split(PAIR_SEPARATOR);
    const lender = net > 0 ? first : second;
    const borrower = net > 0 ? second : first;
    result.push({
      lender: {email: lender, name: nameOf(lender)},
      borrower: {email: borrower, name: nameOf(borrower)},
      amount: toMajorNumber(Math.abs(net), currencyCode),
    });
  });
  return result;
};
