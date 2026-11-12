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

export const calculateNetLendingBalances = (
  splitsArr: readonly LendingSplit[],
  currencyCode: string,
): LendingDetail[] => {
  const balances: Record<string, Record<string, number>> = {};
  splitsArr.forEach(split => {
    // Skip settlements — they are already recorded in the splits list and handled separately
    if (split.type === 'settlement' || split.isSettlement) {
      const fromEmail = split.paidBy?.email?.toLowerCase();
      const toEmail = split.splitUsers?.[0]?.email?.toLowerCase();
      const amt = minorOf(split, currencyCode);
      if (!fromEmail || !toEmail || fromEmail === toEmail || amt === null) {
        return;
      }
      // Borrower paid lender: reduce what borrower owes lender
      if (!balances[toEmail]) {
        balances[toEmail] = {};
      }
      balances[toEmail][fromEmail] = (balances[toEmail][fromEmail] || 0) - amt;
      return;
    }
    const paidByEmail = split.paidBy?.email?.toLowerCase();
    const splitUsers = split.splitUsers || [];
    // Integer minor units: the shares of a split always add up to its total.
    const shares = sharesMinor(split, currencyCode);
    if (!paidByEmail || shares === null) {
      return;
    }
    if (!balances[paidByEmail]) {
      balances[paidByEmail] = {};
    }
    splitUsers.forEach((u, index) => {
      const uEmail = u.email?.toLowerCase();
      if (!uEmail || uEmail === paidByEmail) {
        return;
      }
      balances[paidByEmail][uEmail] =
        (balances[paidByEmail][uEmail] || 0) + shares[index];
    });
  });
  const net: LendingDetail[] = [];
  Object.keys(balances).forEach(lenderEmail => {
    Object.keys(balances[lenderEmail]).forEach(borrowerEmail => {
      if (lenderEmail >= borrowerEmail) {
        return;
      }
      const lTob = balances[lenderEmail][borrowerEmail] || 0;
      const bToL = balances[borrowerEmail]?.[lenderEmail] || 0;
      const netAmt = lTob - bToL;
      if (netAmt !== 0) {
        const lenderName =
          splitsArr.find(s => s.paidBy?.email === lenderEmail)?.paidBy?.name ||
          lenderEmail.split('@')[0];
        const borrowerName =
          splitsArr
            .find(s => s.splitUsers?.some(u => u.email === borrowerEmail))
            ?.splitUsers?.find(u => u.email === borrowerEmail)?.name ||
          borrowerEmail.split('@')[0];
        net.push({
          lender: {
            email: netAmt > 0 ? lenderEmail : borrowerEmail,
            name: netAmt > 0 ? lenderName : borrowerName,
          },
          borrower: {
            email: netAmt > 0 ? borrowerEmail : lenderEmail,
            name: netAmt > 0 ? borrowerName : lenderName,
          },
          amount: toMajorNumber(Math.abs(netAmt), currencyCode),
        });
      }
    });
  });
  const result = net.reduce<LendingDetail[]>((acc, cur) => {
    const exists = acc.find(
      e =>
        (e.lender.email === cur.lender.email &&
          e.borrower.email === cur.borrower.email) ||
        (e.lender.email === cur.borrower.email &&
          e.borrower.email === cur.lender.email),
    );
    if (!exists) {
      acc.push(cur);
    }
    return acc;
  }, []);
  return result;
};
