import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import {resolveCurrency, type Fields} from './derive';
import {getCurrencyExponent, toMajorNumber, tryToMinor} from './money';

/**
 * Recording and deleting a settlement is one all-or-nothing server operation. Before this, the
 * client wrote the settlement, the split entry, its own transaction and both balances one by one,
 * so a failure halfway left the two people's books different, and a delete only undid part of it.
 *
 * recordSettlement writes: the settlement document, the settlement entry in the splits list, the
 * balance change of both people (legacy `balance`, the trigger derives `balanceMinor`) and a
 * "Settlement" transaction for each person (the caller's only if they chose to include it).
 * deleteSettlement undoes all of that. Both run in a single Firestore transaction.
 */

export class SettlementError extends Error {
  constructor(
    readonly code:
      | 'invalid-argument'
      | 'not-found'
      | 'permission-denied'
      | 'failed-precondition',
    message: string,
  ) {
    super(message);
  }
}

export const MAX_SETTLEMENT_MAJOR = 999_999_999;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_NOTE = 200;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !value.includes('/');

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const sameEmail = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

export interface RecordSettlementInput {
  groupId: string;
  /** The person who paid (the borrower). */
  fromEmail: string;
  /** The person who was paid (the lender). */
  toEmail: string;
  amount: string | number;
  note: string;
  includeInTransactions: boolean;
  requestId: string;
}

export const parseRecordInput = (input: unknown): RecordSettlementInput => {
  if (!isRecord(input)) {
    throw new SettlementError('invalid-argument', 'expected an object');
  }
  const {
    groupId,
    fromEmail,
    toEmail,
    amount,
    note,
    includeInTransactions,
    requestId,
  } = input;
  if (!isId(groupId)) {
    throw new SettlementError('invalid-argument', 'groupId is required');
  }
  for (const email of [fromEmail, toEmail]) {
    if (typeof email !== 'string' || !email.includes('@')) {
      throw new SettlementError(
        'invalid-argument',
        'fromEmail and toEmail are required',
      );
    }
  }
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    throw new SettlementError('invalid-argument', 'amount is required');
  }
  if (note !== undefined && typeof note !== 'string') {
    throw new SettlementError('invalid-argument', 'note must be text');
  }
  if ((note ?? '').trim().length > MAX_NOTE) {
    throw new SettlementError('invalid-argument', 'note is too long');
  }
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) {
    throw new SettlementError('invalid-argument', 'requestId is invalid');
  }
  return {
    groupId,
    fromEmail: (fromEmail as string).trim(),
    toEmail: (toEmail as string).trim(),
    amount,
    note: (note ?? '').trim(),
    includeInTransactions: includeInTransactions === true,
    requestId,
  };
};

interface Person {
  uid: string | null;
  email: string;
  name: string;
  avatar: string | null;
  currency: unknown;
}

const memberObject = (person: Person): Fields => ({
  email: person.email,
  name: person.name,
  userId: person.uid,
  ...(person.avatar ? {avatar: person.avatar} : {}),
});

const findUserByEmail = async (
  db: Firestore,
  email: string,
): Promise<{uid: string; data: Fields} | null> => {
  for (const candidate of [email, email.toLowerCase()]) {
    const result = await db
      .collection('users')
      .where('email', '==', candidate)
      .limit(1)
      .get();
    if (!result.empty) {
      return {uid: result.docs[0].id, data: result.docs[0].data() as Fields};
    }
  }
  return null;
};

const personFrom = (
  email: string,
  uid: string | null,
  profile: Fields | undefined,
  group: Fields,
): Person => {
  const memberNames = isRecord(group.memberNames) ? group.memberNames : {};
  return {
    uid,
    email,
    name:
      text(profile?.name) ??
      text(profile?.displayName) ??
      text(memberNames[email]) ??
      email.split('@')[0],
    avatar: text(profile?.avatar),
    currency: profile?.currency,
  };
};

const isGroupMember = (group: Fields, email: string): boolean =>
  Array.isArray(group.members) &&
  group.members.some(member => sameEmail(member, email));

const transactionFor = (
  type: 'expense' | 'income',
  args: {
    note: string;
    groupName: string;
    groupId: string;
    id: string;
    major: number;
    minor: number;
    currency: string;
    date: string;
  },
): Fields => ({
  title: args.note || `Settlement: ${args.groupName}`,
  type,
  category: 'Settlement',
  amount: String(args.major),
  amountMinor: args.minor,
  currency: args.currency,
  date: args.date,
  source: 'split',
  splitId: args.id,
  groupId: args.groupId,
  groupName: args.groupName,
  splitRole: type === 'expense' ? 'settlement_payer' : 'settlement_receiver',
  createdAt: FieldValue.serverTimestamp(),
});

export interface RecordResult {
  settlementId: string;
  splitId: string;
  alreadyRecorded: boolean;
}

export const recordSettlement = async (
  db: Firestore,
  callerUid: string,
  rawInput: unknown,
): Promise<RecordResult> => {
  const input = parseRecordInput(rawInput);
  const id = input.requestId;
  const groupRef = db.collection('groups').doc(input.groupId);
  const settlementRef = groupRef.collection('settlements').doc(id);
  const splitRef = groupRef.collection('splits').doc(id);
  const callerRef = db.collection('users').doc(callerUid);
  const [fromUser, toUser] = await Promise.all([
    findUserByEmail(db, input.fromEmail),
    findUserByEmail(db, input.toEmail),
  ]);

  return db.runTransaction(async tx => {
    const [groupSnap, callerSnap, settlementSnap] = await Promise.all([
      tx.get(groupRef),
      tx.get(callerRef),
      tx.get(settlementRef),
    ]);
    if (settlementSnap.exists) {
      return {settlementId: id, splitId: id, alreadyRecorded: true};
    }
    if (!groupSnap.exists) {
      throw new SettlementError('not-found', 'Group not found.');
    }
    const group = groupSnap.data() as Fields;
    const callerData = (callerSnap.data() ?? {}) as Fields;
    const callerEmail = text(callerData.email);
    if (!callerEmail || !isGroupMember(group, callerEmail)) {
      throw new SettlementError(
        'permission-denied',
        'You are not in this group.',
      );
    }
    if (
      sameEmail(input.fromEmail, input.toEmail) ||
      !isGroupMember(group, input.fromEmail) ||
      !isGroupMember(group, input.toEmail)
    ) {
      throw new SettlementError(
        'invalid-argument',
        'A settlement is between two different members of this group.',
      );
    }
    // The caller is one of the two people, or the creator of the group (who may record a payment
    // between two other members, as the settle-up screen has always allowed for organizers).
    const callerIsFrom = sameEmail(callerEmail, input.fromEmail);
    const callerIsTo = sameEmail(callerEmail, input.toEmail);
    if (!callerIsFrom && !callerIsTo && group.createdBy !== callerUid) {
      throw new SettlementError(
        'permission-denied',
        'You can only record a settlement you are part of, unless you created the group.',
      );
    }

    const currency = resolveCurrency(callerData.currency);
    const minor = tryToMinor(input.amount, currency);
    if (
      minor === null ||
      minor <= 0 ||
      minor > MAX_SETTLEMENT_MAJOR * 10 ** getCurrencyExponent(currency)
    ) {
      throw new SettlementError('invalid-argument', 'The amount is not valid.');
    }
    const major = toMajorNumber(minor, currency);

    const personOf = (
      email: string,
      user: {uid: string; data: Fields} | null,
    ): Person =>
      personFrom(
        text(user?.data.email) ?? email,
        user?.uid ?? null,
        user?.data,
        group,
      );
    const borrower = personOf(input.fromEmail, fromUser);
    const lender = personOf(input.toEmail, toUser);
    const from = memberObject(borrower);
    const to = memberObject(lender);

    const groupName = text(group.name) ?? 'Group';
    const date = new Date().toISOString().split('T')[0];
    const txArgs = {
      note: input.note,
      groupName,
      groupId: input.groupId,
      id,
      major,
      minor,
      currency,
      date,
    };

    tx.set(settlementRef, {
      from,
      to,
      amount: major,
      amountMinor: minor,
      currency,
      note: input.note,
      status: 'completed',
      createdAt: FieldValue.serverTimestamp(),
      groupId: input.groupId,
      recordedBy: callerUid,
    });
    tx.set(splitRef, {
      title: input.note || 'Settlement Payment',
      amount: major,
      amountMinor: minor,
      currency,
      category: 'Settlement',
      paidBy: from,
      splitUsers: [to],
      date: Timestamp.now(),
      createdAt: FieldValue.serverTimestamp(),
      type: 'settlement',
      isSettlement: true,
      settlement: {from, to, amount: major},
      settlementId: id,
    });

    // The borrower pays (balance goes down), the lender receives (balance goes up).
    if (borrower.uid) {
      tx.update(db.collection('users').doc(borrower.uid), {
        balance: FieldValue.increment(-major),
      });
    }
    if (lender.uid) {
      tx.update(db.collection('users').doc(lender.uid), {
        balance: FieldValue.increment(major),
      });
    }

    const writeTransaction = (
      person: Person,
      isBorrower: boolean,
      wanted: boolean,
    ): void => {
      if (!person.uid || !wanted) {
        return;
      }
      tx.set(
        db
          .collection('users')
          .doc(person.uid)
          .collection('transactions')
          .doc(id),
        transactionFor(isBorrower ? 'expense' : 'income', txArgs),
      );
    };
    // The other person always gets their entry; the caller's own entry follows their choice.
    // Someone recording for two other members (the group creator) gets none.
    writeTransaction(
      borrower,
      true,
      !callerIsFrom || input.includeInTransactions,
    );
    writeTransaction(lender, false, !callerIsTo || input.includeInTransactions);

    return {settlementId: id, splitId: id, alreadyRecorded: false};
  });
};

export interface DeleteSettlementInput {
  groupId: string;
  splitId: string;
}

export const parseDeleteInput = (input: unknown): DeleteSettlementInput => {
  if (!isRecord(input) || !isId(input.groupId) || !isId(input.splitId)) {
    throw new SettlementError(
      'invalid-argument',
      'groupId and splitId are required',
    );
  }
  return {groupId: input.groupId, splitId: input.splitId};
};

export interface DeleteResult {
  deleted: boolean;
  settlementRemoved: boolean;
}

const toMillis = (value: unknown): number | null =>
  value instanceof Timestamp ? value.toMillis() : null;

export const deleteSettlement = async (
  db: Firestore,
  callerUid: string,
  rawInput: unknown,
): Promise<DeleteResult> => {
  const {groupId, splitId} = parseDeleteInput(rawInput);
  const groupRef = db.collection('groups').doc(groupId);
  const splitRef = groupRef.collection('splits').doc(splitId);
  const callerRef = db.collection('users').doc(callerUid);

  // Resolve the two people's uids before the transaction (older settlements may lack userId).
  const preSplit = await splitRef.get();
  if (!preSplit.exists) {
    return {deleted: false, settlementRemoved: false};
  }
  const pre = preSplit.data() as Fields;
  const emailOf = (member: unknown): string | null =>
    isRecord(member) ? text(member.email) : null;
  const preSplitUsers = Array.isArray(pre.splitUsers) ? pre.splitUsers : [];
  const borrowerEmail = emailOf(pre.paidBy);
  const lenderEmail = emailOf(preSplitUsers[0]);
  const uidOfMember = async (
    member: unknown,
    email: string | null,
  ): Promise<string | null> => {
    if (isRecord(member) && isId(member.userId)) {
      return member.userId;
    }
    return email ? (await findUserByEmail(db, email))?.uid ?? null : null;
  };
  const borrowerUid = await uidOfMember(pre.paidBy, borrowerEmail);
  const lenderUid = await uidOfMember(preSplitUsers[0], lenderEmail);

  return db.runTransaction(async tx => {
    const [splitSnap, groupSnap, callerSnap] = await Promise.all([
      tx.get(splitRef),
      tx.get(groupRef),
      tx.get(callerRef),
    ]);
    if (!splitSnap.exists) {
      return {deleted: false, settlementRemoved: false};
    }
    const split = splitSnap.data() as Fields;
    if (split.type !== 'settlement') {
      throw new SettlementError(
        'failed-precondition',
        'This is not a settlement.',
      );
    }
    const group = (groupSnap.data() ?? {}) as Fields;
    const caller = (callerSnap.data() ?? {}) as Fields;
    const isParty =
      callerUid === borrowerUid ||
      callerUid === lenderUid ||
      sameEmail(caller.email, borrowerEmail) ||
      sameEmail(caller.email, lenderEmail) ||
      group.createdBy === callerUid;
    if (!isParty) {
      throw new SettlementError(
        'permission-denied',
        'Only the people in the settlement or the group creator can delete it.',
      );
    }

    const currency = resolveCurrency(split.currency, caller.currency);
    const minor =
      typeof split.amountMinor === 'number' &&
      Number.isSafeInteger(split.amountMinor)
        ? split.amountMinor
        : typeof split.amount === 'string' || typeof split.amount === 'number'
        ? tryToMinor(split.amount, currency)
        : null;
    if (minor === null || minor <= 0) {
      throw new SettlementError(
        'failed-precondition',
        'The settlement amount cannot be read, so it was not deleted.',
      );
    }
    const major = toMajorNumber(minor, currency);

    // The linked settlement document: by id for settlements made through recordSettlement,
    // else the one settlement of this group with the same people, amount and time.
    const settlementsRef = groupRef.collection('settlements');
    const linkedId = text(split.settlementId);
    let settlementRef: DocumentReference | null = null;
    if (linkedId) {
      const linked = await tx.get(settlementsRef.doc(linkedId));
      settlementRef = linked.exists ? linked.ref : null;
    } else {
      const all = await tx.get(settlementsRef);
      const splitTime = toMillis(split.createdAt);
      const matches = all.docs.filter(d => {
        const s = d.data() as Fields;
        const sMinor =
          typeof s.amountMinor === 'number'
            ? s.amountMinor
            : tryToMinor(s.amount as string | number, currency);
        const sTime = toMillis(s.createdAt);
        return (
          sameEmail(emailOf(s.from), borrowerEmail) &&
          sameEmail(emailOf(s.to), lenderEmail) &&
          sMinor === minor &&
          splitTime !== null &&
          sTime !== null &&
          Math.abs(sTime - splitTime) <= 120_000
        );
      });
      settlementRef = matches.length === 1 ? matches[0].ref : null;
    }

    const transactionRefs: DocumentReference[] = [];
    for (const uid of [borrowerUid, lenderUid]) {
      if (!uid) {
        continue;
      }
      const found = await tx.get(
        db
          .collection('users')
          .doc(uid)
          .collection('transactions')
          .where('splitId', '==', splitId),
      );
      transactionRefs.push(...found.docs.map(d => d.ref));
    }

    // A deleted account has no document to update; skip it instead of failing the delete.
    const accountExists = async (uid: string | null): Promise<boolean> =>
      uid !== null && (await tx.get(db.collection('users').doc(uid))).exists;
    const borrowerExists = await accountExists(borrowerUid);
    const lenderExists = await accountExists(lenderUid);

    tx.delete(splitRef);
    if (settlementRef) {
      tx.delete(settlementRef);
    }
    transactionRefs.forEach(ref => tx.delete(ref));
    // Undo the balance change: the borrower gets the money back, the lender loses it.
    if (borrowerExists) {
      tx.update(db.collection('users').doc(borrowerUid!), {
        balance: FieldValue.increment(major),
      });
    }
    if (lenderExists) {
      tx.update(db.collection('users').doc(lenderUid!), {
        balance: FieldValue.increment(-major),
      });
    }
    return {deleted: true, settlementRemoved: settlementRef !== null};
  });
};
