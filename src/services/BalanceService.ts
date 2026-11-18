import {
  collection,
  doc,
  getFirestore,
  increment,
  runTransaction,
  Timestamp,
} from '@react-native-firebase/firestore';
import {
  BALANCE_ADJUSTMENT_CATEGORY,
  BALANCE_ADJUSTMENT_SOURCE,
  adjustmentFor,
} from '../utils/balanceAdjust';
import {fromMinor, toMajorNumber} from '../utils/money';
import {todayAsYMD} from '../utils/formatters';

export class BalanceError extends Error {
  /** 'no-change': the typed balance is unreadable or already equals the app's. */
  constructor(readonly code: 'no-change') {
    super(code);
  }
}

/**
 * Sets the running balance to what the person says it is, by recording one "Balance adjustment"
 * transaction for the difference (income when the real balance is higher, expense when lower) and
 * moving the legacy balance by the same exact amount, all in one Firestore transaction. The balance
 * is read inside the transaction, so a split arriving at the same moment cannot make it wrong. The
 * entry carries `source: 'balance_adjustment'`, which Statistics, Home totals, budgets and the
 * summaries leave out, so it never shows up as made-up income or spending.
 *
 * Returns the recorded difference in minor units (negative when the balance went down).
 */
export const adjustBalance = async (
  uid: string,
  actualBalanceText: string,
  currencyCode: string,
): Promise<number> => {
  const db = getFirestore();
  const userRef = doc(db, 'users', uid);
  const txRef = doc(collection(userRef, 'transactions'));
  return runTransaction(db, async txn => {
    const snap = await txn.get(userRef);
    const adjustment = adjustmentFor(
      snap.data()?.balance ?? 0,
      actualBalanceText,
      currencyCode,
    );
    if (adjustment === null) {
      throw new BalanceError('no-change');
    }
    txn.set(txRef, {
      userId: uid,
      documentId: txRef.id,
      title: 'Balance adjustment',
      description: 'Added to match your real balance',
      amount: fromMinor(adjustment.amountMinor, currencyCode),
      amountMinor: adjustment.amountMinor,
      currency: currencyCode,
      category: BALANCE_ADJUSTMENT_CATEGORY,
      date: todayAsYMD(),
      type: adjustment.type,
      source: BALANCE_ADJUSTMENT_SOURCE,
      createdAt: Timestamp.fromDate(new Date()),
    });
    txn.update(userRef, {
      balance: increment(toMajorNumber(adjustment.deltaMinor, currencyCode)),
    });
    return adjustment.deltaMinor;
  });
};
