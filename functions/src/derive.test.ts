import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  changedFields,
  deriveAmountDocument,
  deriveGroup,
  deriveSavingsHistory,
  deriveTransaction,
  deriveUser,
  normalizeDate,
  resolveCurrency,
  type Fields,
} from './derive';

describe('deriveGroup', () => {
  const group: Fields = {members: ['a@x.com', 'b@x.com', 'c@x.com']};

  it('lists the uid of every member in order', () => {
    const out = deriveGroup(group, ['u1', 'u2', 'u3']);
    assert.deepEqual(out.fields, {memberIds: ['u1', 'u2', 'u3']});
    assert.deepEqual(out.skipped, []);
  });

  it('keeps resolved members and reports the unresolved ones once', () => {
    const out = deriveGroup(group, ['u1', undefined, undefined]);
    assert.deepEqual(out.fields, {memberIds: ['u1']});
    assert.deepEqual(out.skipped, ['members']);
  });

  it('drops repeated uids and handles an empty member list', () => {
    assert.deepEqual(deriveGroup(group, ['u1', 'u1', 'u2']).fields, {
      memberIds: ['u1', 'u2'],
    });
    assert.deepEqual(deriveGroup({members: []}, []).fields, {memberIds: []});
  });

  it('does nothing for a group without a members array', () => {
    assert.deepEqual(deriveGroup({name: 'x'}, []).fields, {});
    assert.deepEqual(deriveGroup({members: 'a@x.com'}, []).fields, {});
  });

  it('is stable once written', () => {
    const written: Fields = {
      ...group,
      ...deriveGroup(group, ['u1', 'u2', 'u3']).fields,
    };
    assert.equal(
      changedFields(written, deriveGroup(written, ['u1', 'u2', 'u3']).fields),
      null,
    );
  });
});

describe('resolveCurrency', () => {
  it('takes the first valid code, upper-cased, else INR', () => {
    assert.equal(resolveCurrency('usd', 'EUR'), 'USD');
    assert.equal(resolveCurrency(undefined, 'eur'), 'EUR');
    assert.equal(resolveCurrency('', undefined, null), 'INR');
    assert.equal(resolveCurrency('rupees', 12), 'INR');
    assert.equal(resolveCurrency(' aed '), 'AED');
  });
});

describe('normalizeDate', () => {
  it('pads months and days', () => {
    assert.equal(normalizeDate('2025-5-4'), '2025-05-04');
    assert.equal(normalizeDate('2025-11-14'), '2025-11-14');
  });
  it('rejects things that are not real dates', () => {
    assert.equal(normalizeDate('2025-13-01'), null);
    assert.equal(normalizeDate('2025-02-30'), null);
    assert.equal(normalizeDate('14/11/2025'), null);
    assert.equal(normalizeDate(20251114), null);
    assert.equal(normalizeDate(undefined), null);
  });
});

describe('deriveTransaction', () => {
  it('converts a string amount with 4 decimals and uses the owner currency', () => {
    const d = deriveTransaction({amount: '123.4567', date: '2025-5-4'}, 'USD');
    assert.deepEqual(d.fields, {
      currency: 'USD',
      amountMinor: 12346,
      dateISO: '2025-05-04',
    });
    assert.deepEqual(d.skipped, []);
  });

  it('prefers the document currency and defaults to INR', () => {
    assert.equal(
      deriveTransaction({amount: 5, currency: 'eur'}, 'USD').fields.currency,
      'EUR',
    );
    assert.equal(
      deriveTransaction({amount: 5}, undefined).fields.currency,
      'INR',
    );
  });

  it('skips and reports values it cannot convert, without throwing', () => {
    const huge = deriveTransaction(
      {amount: '10000000000000000000000000000', date: 'nope'},
      'INR',
    );
    assert.equal('amountMinor' in huge.fields, false);
    assert.equal('dateISO' in huge.fields, false);
    assert.deepEqual(huge.skipped, ['amount', 'date']);
    assert.deepEqual(deriveTransaction({amount: {nested: 1}}, 'INR').skipped, [
      'amount',
    ]);
  });

  it('ignores absent fields', () => {
    const d = deriveTransaction({}, 'INR');
    assert.deepEqual(d.fields, {currency: 'INR'});
    assert.deepEqual(d.skipped, []);
  });
});

describe('deriveAmountDocument (splits, settlements, ious)', () => {
  it('handles a float total', () => {
    assert.deepEqual(
      deriveAmountDocument({amount: 33.3333333333}, 'INR').fields,
      {
        currency: 'INR',
        amountMinor: 3333,
      },
    );
  });
  it('uses the document currency when present', () => {
    assert.equal(
      deriveAmountDocument({amount: 100, currency: 'AED'}, 'INR').fields
        .currency,
      'AED',
    );
  });
});

describe('deriveSavingsHistory', () => {
  it('converts the three amounts when present', () => {
    const d = deriveSavingsHistory(
      {amount: 500, previousAmount: 1000, newAmount: 1500},
      'INR',
    );
    assert.deepEqual(d.fields, {
      currency: 'INR',
      amountMinor: 50000,
      previousAmountMinor: 100000,
      newAmountMinor: 150000,
    });
  });
  it('leaves goal events (no amounts) untouched', () => {
    const d = deriveSavingsHistory(
      {type: 'goal_created', goalId: 'g1', newGoal: {target: 5}},
      'INR',
    );
    assert.deepEqual(d.fields, {});
    assert.deepEqual(d.skipped, []);
  });
});

describe('deriveUser', () => {
  it('derives balanceMinor and a goals map keyed by id', () => {
    const d = deriveUser({
      currency: 'USD',
      balance: 12.345,
      savingsGoals: [
        {id: 'a', current: 100, target: 500, monthly: 50},
        {id: 'b', current: 0, target: 1000, monthly: 10},
      ],
    });
    assert.equal(d.fields.balanceMinor, 1235);
    assert.deepEqual(d.fields.savingsGoalsMinor, {
      a: {currentMinor: 10000, targetMinor: 50000, monthlyMinor: 5000},
      b: {currentMinor: 0, targetMinor: 100000, monthlyMinor: 1000},
    });
    assert.deepEqual(d.skipped, []);
  });

  it('writes an empty map for an empty goals array and nothing when there is no array', () => {
    assert.deepEqual(deriveUser({savingsGoals: []}).fields, {
      savingsGoalsMinor: {},
    });
    assert.deepEqual(deriveUser({name: 'x'}).fields, {});
  });

  it('reports goals without an id and unconvertible balances', () => {
    const d = deriveUser({
      balance: 'abc',
      savingsGoals: [
        {current: 1},
        {id: 'ok', current: 1, target: 2, monthly: 3},
      ],
    });
    assert.equal('balanceMinor' in d.fields, false);
    assert.deepEqual(d.skipped, ['balance', 'savingsGoals.(no id)']);
    assert.deepEqual(Object.keys(d.fields.savingsGoalsMinor as Fields), ['ok']);
  });

  it('uses JPY with no minor unit', () => {
    assert.equal(
      deriveUser({currency: 'JPY', balance: 1234.5}).fields.balanceMinor,
      1235,
    );
  });
});

describe('changedFields (the loop guard)', () => {
  it('returns null once the document already holds the derived values', () => {
    const data: Fields = {amount: '10.5', date: '2025-5-4', title: 'x'};
    const first = deriveTransaction(data, 'INR');
    const changed = changedFields(data, first.fields);
    assert.deepEqual(changed, {
      currency: 'INR',
      amountMinor: 1050,
      dateISO: '2025-05-04',
    });
    // After the write, deriving again must produce no change.
    const written: Fields = {...data, ...changed};
    assert.equal(
      changedFields(written, deriveTransaction(written, 'INR').fields),
      null,
    );
  });

  it('only returns the fields that differ', () => {
    const data: Fields = {amount: 10, currency: 'INR', amountMinor: 999};
    assert.deepEqual(
      changedFields(data, deriveTransaction(data, 'INR').fields),
      {amountMinor: 1000},
    );
  });

  it('compares nested maps without regard to key order', () => {
    const existing: Fields = {savingsGoalsMinor: {b: {x: 1, y: 2}, a: {x: 3}}};
    assert.equal(
      changedFields(existing, {
        savingsGoalsMinor: {a: {x: 3}, b: {y: 2, x: 1}},
      }),
      null,
    );
    assert.notEqual(
      changedFields(existing, {
        savingsGoalsMinor: {a: {x: 4}, b: {x: 1, y: 2}},
      }),
      null,
    );
  });

  it('is stable for user documents', () => {
    const data: Fields = {
      currency: 'INR',
      balance: 99.99,
      savingsGoals: [{id: 'a', current: 1, target: 2, monthly: 3}],
    };
    const written: Fields = {
      ...data,
      ...changedFields(data, deriveUser(data).fields),
    };
    assert.equal(changedFields(written, deriveUser(written).fields), null);
  });
});
