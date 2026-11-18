import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import {fromMinor, toMajorNumber} from '../utils/money';
import {paymentIdFor, type CardPeriod} from '../utils/cardPeriods';
import {
  CARD_PAYMENT_SOURCE,
  parseCardDoc,
  type CardDocument,
  type CardInput,
} from '../utils/cards';
import {todayAsYMD} from '../utils/formatters';

/**
 * Credit cards and the bills paid for them: `users/{uid}/cards/{id}` and
 * `users/{uid}/cardPayments/{cardId_periodEnd}` (owner-only, covered by the existing rules).
 * Purchases on a card are ordinary transactions with a `cardId`; the balance moves only here, when
 * a bill is paid or the payment is undone.
 */

export interface CardPaymentDocument {
  id: string;
  cardId: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  /** What the bank's statement said, when the person typed it; null otherwise. */
  statementMinor: number | null;
  /** The transfer transaction this payment created. */
  transactionId: string;
}

export const parsePaymentDoc = (
  id: string,
  data: unknown,
): CardPaymentDocument | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const d = data as Record<string, unknown>;
  if (
    typeof d.cardId !== 'string' ||
    typeof d.periodStart !== 'string' ||
    typeof d.periodEnd !== 'string' ||
    typeof d.amountMinor !== 'number' ||
    !Number.isSafeInteger(d.amountMinor) ||
    typeof d.currency !== 'string' ||
    typeof d.transactionId !== 'string'
  ) {
    return null;
  }
  return {
    id,
    cardId: d.cardId,
    periodStart: d.periodStart,
    periodEnd: d.periodEnd,
    amountMinor: d.amountMinor,
    currency: d.currency,
    statementMinor:
      typeof d.statementMinor === 'number' &&
      Number.isSafeInteger(d.statementMinor)
        ? d.statementMinor
        : null,
    transactionId: d.transactionId,
  };
};

/** Every card of the user, oldest first. Documents that cannot be used are skipped. */
export const loadCards = async (uid: string): Promise<CardDocument[]> => {
  const snapshot = await getDocs(
    collection(getFirestore(), 'users', uid, 'cards'),
  );
  const cards: {card: CardDocument; created: number}[] = [];
  snapshot.docs.forEach(d => {
    const card = parseCardDoc(d.id, d.data());
    if (card) {
      const created = d.data()?.createdAt;
      cards.push({
        card,
        created:
          typeof created?.toMillis === 'function' ? created.toMillis() : 0,
      });
    }
  });
  return cards.sort((a, b) => a.created - b.created).map(c => c.card);
};

export const loadCardPayments = async (
  uid: string,
): Promise<CardPaymentDocument[]> => {
  const snapshot = await getDocs(
    collection(getFirestore(), 'users', uid, 'cardPayments'),
  );
  const payments: CardPaymentDocument[] = [];
  snapshot.docs.forEach(d => {
    const payment = parsePaymentDoc(d.id, d.data());
    if (payment) {
      payments.push(payment);
    }
  });
  return payments;
};

/** Creates a card (no id) or replaces the fields of an existing one. Returns its id. */
export const saveCard = async (
  uid: string,
  id: string | null,
  data: CardInput,
): Promise<string> => {
  const db = getFirestore();
  if (id === null) {
    const ref = doc(collection(db, 'users', uid, 'cards'));
    await setDoc(ref, {...data, createdAt: serverTimestamp()});
    return ref.id;
  }
  await updateDoc(doc(db, 'users', uid, 'cards', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  return id;
};

/**
 * Removes a card the person no longer uses. Its purchases stay as they are (they keep the card id
 * and still count when its bill is looked at through an archived card), so a card with purchases
 * is archived instead; an unused card is deleted.
 */
export const archiveCard = async (uid: string, id: string): Promise<void> => {
  await updateDoc(doc(getFirestore(), 'users', uid, 'cards', id), {
    archived: true,
    updatedAt: serverTimestamp(),
  });
};

export const deleteCard = async (uid: string, id: string): Promise<void> => {
  await deleteDoc(doc(getFirestore(), 'users', uid, 'cards', id));
};

export class CardBillError extends Error {
  constructor(readonly code: 'already-paid' | 'not-paid' | 'invalid-amount') {
    super(code);
  }
}

/**
 * Pays one card bill: in one Firestore transaction it writes the payment (refused if the period
 * is already paid, so a double tap cannot take the money twice), a transfer transaction that
 * Statistics and budgets leave out, and lowers the legacy balance by the paid amount. The server
 * derives `balanceMinor` from the legacy balance, as for every other write.
 */
export const payBill = async (
  uid: string,
  card: Pick<CardDocument, 'id' | 'name' | 'currency'>,
  period: CardPeriod,
  amountMinor: number,
  statementMinor: number | null,
): Promise<void> => {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new CardBillError('invalid-amount');
  }
  const db = getFirestore();
  const userRef = doc(db, 'users', uid);
  const paymentRef = doc(
    collection(userRef, 'cardPayments'),
    paymentIdFor(card.id, period),
  );
  const txRef = doc(collection(userRef, 'transactions'));
  await runTransaction(db, async txn => {
    const existing = await txn.get(paymentRef);
    if (existing.exists()) {
      throw new CardBillError('already-paid');
    }
    txn.set(txRef, {
      userId: uid,
      documentId: txRef.id,
      title: `${card.name} bill`,
      description: '',
      // Not a spend: no `cardId` here (that would stop it from moving the balance) and the
      // source marks it as a transfer for Statistics, budgets and the summaries.
      amount: fromMinor(amountMinor, card.currency),
      amountMinor,
      currency: card.currency,
      category: 'Card bill',
      date: todayAsYMD(),
      type: 'expense',
      source: CARD_PAYMENT_SOURCE,
      cardBillFor: card.id,
      // Lets deleting this transaction undo the payment (see TransactionDetailScreen).
      cardPaymentId: paymentRef.id,
      createdAt: Timestamp.fromDate(new Date()),
    });
    txn.set(paymentRef, {
      cardId: card.id,
      periodStart: period.start,
      periodEnd: period.end,
      amountMinor,
      currency: card.currency,
      ...(statementMinor !== null ? {statementMinor} : {}),
      transactionId: txRef.id,
      paidAt: serverTimestamp(),
    });
    txn.update(userRef, {
      balance: increment(-toMajorNumber(amountMinor, card.currency)),
    });
  });
};

/** Undoes a payment: removes the payment and its transfer and gives the money back. */
export const undoBillPayment = async (
  uid: string,
  paymentId: string,
): Promise<void> => {
  const db = getFirestore();
  const userRef = doc(db, 'users', uid);
  const paymentRef = doc(collection(userRef, 'cardPayments'), paymentId);
  await runTransaction(db, async txn => {
    const snap = await txn.get(paymentRef);
    if (!snap.exists()) {
      throw new CardBillError('not-paid');
    }
    const data = parsePaymentDoc(snap.id, snap.data());
    if (!data) {
      throw new CardBillError('not-paid');
    }
    txn.delete(doc(collection(userRef, 'transactions'), data.transactionId));
    txn.delete(paymentRef);
    txn.update(userRef, {
      balance: increment(toMajorNumber(data.amountMinor, data.currency)),
    });
  });
};
