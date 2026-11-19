import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import {DEFAULT_TIME_ZONE} from './budgets';
import {
  CARD_REMINDER_HOUR,
  alertId,
  owedMinor,
  parseCard,
  paymentId,
  reminderFor,
  reminderMessage,
} from './cardDue';
import {fromMinor} from './money';
import {notifyUids, type NotifyDeps} from './notify';
import {localMoment} from './weekly';

const ALREADY_EXISTS = 6;

export interface CardDueDeps extends NotifyDeps {
  db: Firestore;
  now?: () => number;
}

export interface CardDueResult {
  /** Reminder marker ids created (and so sent) by this run. */
  sent: string[];
}

/**
 * Card bill reminders. Hourly; for each card whose owner's local time is CARD_REMINDER_HOUR, asks
 * `reminderFor` whether today is three days before or the day of the bill's due date. A bill that
 * is already marked paid, or that owes nothing, is skipped. The marker
 * `users/{uid}/cardAlerts/{cardId_periodEnd_stage}` is created with `create()` before sending, so
 * reruns and overlapping runs send each reminder once.
 */
export const runCardDue = async (deps: CardDueDeps): Promise<CardDueResult> => {
  const nowMs = (deps.now ?? Date.now)();
  const result: CardDueResult = {sent: []};
  const zones = new Map<string, string>();

  const zoneOf = async (uid: string): Promise<string> => {
    const known = zones.get(uid);
    if (known !== undefined) {
      return known;
    }
    const snap = await deps.db.collection('users').doc(uid).get();
    const zone = snap.get('timeZone');
    const value =
      typeof zone === 'string' && zone !== '' ? zone : DEFAULT_TIME_ZONE;
    zones.set(uid, value);
    return value;
  };

  const cards = await deps.db.collectionGroup('cards').get();
  for (const doc of cards.docs) {
    const userRef = doc.ref.parent.parent;
    const card = parseCard(doc.id, doc.data());
    if (!userRef || !card || card.archived || card.dueDay === null) {
      continue;
    }
    try {
      const local = localMoment(nowMs, await zoneOf(userRef.id));
      if (local.hour !== CARD_REMINDER_HOUR) {
        continue;
      }
      const reminder = reminderFor(card, local.date);
      if (!reminder) {
        continue;
      }
      const paid = await userRef
        .collection('cardPayments')
        .doc(paymentId(card.id, reminder.period))
        .get();
      if (paid.exists) {
        continue;
      }
      const transactions = await userRef
        .collection('transactions')
        .where('cardId', '==', card.id)
        .get();
      const owed = owedMinor(
        card,
        reminder.period,
        transactions.docs.map(d => d.data()),
      );
      if (owed <= 0) {
        continue;
      }
      const marker = userRef
        .collection('cardAlerts')
        .doc(alertId(card.id, reminder.period, reminder.stage));
      try {
        await marker.create({
          cardId: card.id,
          periodEnd: reminder.period.end,
          stage: reminder.stage,
          dueDate: reminder.dueDate,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        if ((error as {code?: unknown}).code === ALREADY_EXISTS) {
          continue;
        }
        throw error;
      }
      const message = reminderMessage(
        card,
        reminder.stage,
        fromMinor(owed, card.currency),
        card.currency,
      );
      await notifyUids(deps, [userRef.id], {
        ...message,
        data: {type: 'card_due', cardId: card.id},
      });
      result.sent.push(marker.id);
    } catch (error) {
      logger.error('Card reminder failed', {
        path: doc.ref.path,
        error: String(error),
      });
    }
  }
  return result;
};
