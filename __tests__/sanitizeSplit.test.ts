import {describe, expect, it} from '@jest/globals';
import {sanitizeHistoryEntry, sanitizeSplit} from '../src/data/sanitizeSplit';

const oldSplit = {
  id: 's1',
  title: 'Dinner',
  amount: '120.50',
  amountMinor: 12050,
  category: 'Food',
  paidBy: {
    email: 'a@x.com',
    name: 'A',
    userId: 'ua',
    phone: '9876543210',
    fcmToken: 'secret-token',
    balance: 5,
    savingsGoals: [{id: 'g'}],
    transactions: [{id: 't'}],
  },
  splitUsers: [
    {
      email: 'a@x.com',
      name: 'A',
      userId: 'ua',
      percentage: 60,
      phone: '9876543210',
      fcmToken: 'secret-token',
    },
    {email: 'b@x.com', name: 'B', userId: 'ub', userImg: 'https://img'},
  ],
  notes: 'two plates',
};

describe('sanitizeSplit', () => {
  it('drops everything about a person except what the screens read', () => {
    const result = sanitizeSplit(oldSplit);
    expect(result.paidBy).toEqual({email: 'a@x.com', name: 'A', userId: 'ua'});
    expect(result.splitUsers).toEqual([
      {email: 'a@x.com', name: 'A', userId: 'ua', percentage: 60},
      {email: 'b@x.com', name: 'B', userId: 'ub'},
    ]);
  });

  it('keeps no phone number or push token anywhere in the result', () => {
    const text = JSON.stringify(sanitizeSplit(oldSplit));
    expect(text).not.toContain('9876543210');
    expect(text).not.toContain('secret-token');
  });

  it('leaves every other field of the split exactly as it was', () => {
    const result = sanitizeSplit(oldSplit);
    expect(result.id).toBe('s1');
    expect(result.title).toBe('Dinner');
    expect(result.amount).toBe('120.50');
    expect(result.amountMinor).toBe(12050);
    expect(result.category).toBe('Food');
    expect(result.notes).toBe('two plates');
  });

  it('does not change the document it was given', () => {
    sanitizeSplit(oldSplit);
    expect(oldSplit.paidBy.fcmToken).toBe('secret-token');
    expect(oldSplit.splitUsers[0].phone).toBe('9876543210');
  });

  it('copes with documents that have no people or odd shapes', () => {
    expect(sanitizeSplit({id: 'x', amount: 5})).toEqual({id: 'x', amount: 5});
    expect(sanitizeSplit({id: 'x', paidBy: null, splitUsers: 'none'})).toEqual({
      id: 'x',
      paidBy: null,
      splitUsers: 'none',
    });
    expect(
      sanitizeSplit({id: 'x', splitUsers: [null, 'a']}).splitUsers,
    ).toEqual([null, 'a']);
  });

  it('does not add fields a person did not have', () => {
    const result = sanitizeSplit({
      id: 'x',
      paidBy: {email: 'a@x.com'},
      splitUsers: [{email: 'b@x.com'}],
    });
    expect(result.paidBy).toEqual({email: 'a@x.com'});
    expect(result.splitUsers).toEqual([{email: 'b@x.com'}]);
  });
});

describe('sanitizeHistoryEntry', () => {
  const entry = {
    id: 'h1',
    type: 'settlement_create',
    amount: 50,
    paidBy: {email: 'a@x.com', name: 'A', userId: 'ua', phone: '111'},
    settlement: {
      from: {email: 'a@x.com', name: 'A', userId: 'ua', fcmToken: 'tok'},
      to: {email: 'b@x.com', name: 'B', phone: '222'},
      amount: 50,
    },
    changes: [{field: 'amount', before: 1, after: 2}],
  };

  it('keeps only the fields the history screen reads for each person', () => {
    const result = sanitizeHistoryEntry(entry);
    expect(result.paidBy).toEqual({email: 'a@x.com', name: 'A', userId: 'ua'});
    expect(result.settlement).toEqual({
      from: {email: 'a@x.com', name: 'A', userId: 'ua'},
      to: {email: 'b@x.com', name: 'B'},
      amount: 50,
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain('111');
    expect(text).not.toContain('222');
    expect(text).not.toContain('tok');
  });

  it('leaves other fields alone and copes with entries that have no people', () => {
    expect(sanitizeHistoryEntry(entry).changes).toEqual(entry.changes);
    expect(sanitizeHistoryEntry({id: 'x', type: 'delete'})).toEqual({
      id: 'x',
      type: 'delete',
    });
    expect(sanitizeHistoryEntry({id: 'x', settlement: 'odd'}).settlement).toBe(
      'odd',
    );
  });
});
