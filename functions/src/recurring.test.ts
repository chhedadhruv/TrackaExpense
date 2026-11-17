import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  addDays,
  buildTransaction,
  occurrenceAfter,
  occurrenceAt,
  occurrenceFrom,
  parseRule,
  planRun,
  recurringTransactionId,
  type RecurringRule,
} from './recurring';

const rule = (over: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'r1',
  title: 'Rent',
  description: '',
  type: 'expense',
  category: 'Rent',
  amountMinor: 1500000,
  currency: 'INR',
  frequency: 'monthly',
  startDate: '2026-01-31',
  endDate: null,
  nextDueDate: '2026-01-31',
  timeZone: 'Asia/Kolkata',
  enabled: true,
  tags: [],
  ...over,
});

describe('addDays', () => {
  it('crosses month and year ends', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  });
});

describe('occurrenceAt', () => {
  it('weekly steps seven days', () => {
    const r = {frequency: 'weekly' as const, startDate: '2026-11-02'};
    assert.equal(occurrenceAt(r, 0), '2026-11-02');
    assert.equal(occurrenceAt(r, 1), '2026-11-09');
    assert.equal(occurrenceAt(r, 9), '2027-01-04');
  });

  it('monthly keeps the start day and clamps to short months without drifting', () => {
    const r = {frequency: 'monthly' as const, startDate: '2026-01-31'};
    assert.equal(occurrenceAt(r, 1), '2026-02-28');
    assert.equal(occurrenceAt(r, 2), '2026-03-31');
    assert.equal(occurrenceAt(r, 3), '2026-04-30');
    assert.equal(occurrenceAt(r, 13), '2027-02-28');
    assert.equal(occurrenceAt(r, 25), '2028-02-29');
  });

  it('monthly rolls over the year', () => {
    const r = {frequency: 'monthly' as const, startDate: '2026-11-15'};
    assert.equal(occurrenceAt(r, 2), '2027-01-15');
    assert.equal(occurrenceAt(r, 14), '2028-01-15');
  });

  it('yearly keeps the day and clamps February 29', () => {
    const r = {frequency: 'yearly' as const, startDate: '2028-02-29'};
    assert.equal(occurrenceAt(r, 1), '2029-02-28');
    assert.equal(occurrenceAt(r, 4), '2032-02-29');
  });
});

describe('occurrenceAfter and occurrenceFrom', () => {
  const r = {frequency: 'monthly' as const, startDate: '2026-01-31'};
  it('finds the first occurrence strictly after a date', () => {
    assert.equal(occurrenceAfter(r, '2026-01-31'), '2026-02-28');
    assert.equal(occurrenceAfter(r, '2026-02-28'), '2026-03-31');
    assert.equal(occurrenceAfter(r, '2025-01-01'), '2026-01-31');
  });
  it('finds the first occurrence on or after a date', () => {
    assert.equal(occurrenceFrom(r, '2026-02-28'), '2026-02-28');
    assert.equal(occurrenceFrom(r, '2026-03-01'), '2026-03-31');
  });
});

describe('parseRule', () => {
  const doc = {
    title: ' Rent ',
    type: 'expense',
    category: 'Rent',
    amountMinor: 1500000,
    currency: 'inr',
    frequency: 'monthly',
    startDate: '2026-1-31',
  };

  it('reads a document, normalising dates and defaulting nextDueDate to the start', () => {
    const parsed = parseRule('r1', doc);
    assert.ok(parsed);
    assert.equal(parsed.title, 'Rent');
    assert.equal(parsed.currency, 'INR');
    assert.equal(parsed.startDate, '2026-01-31');
    assert.equal(parsed.nextDueDate, '2026-01-31');
    assert.equal(parsed.enabled, true);
    assert.equal(parsed.timeZone, 'Asia/Kolkata');
    assert.equal(parsed.endDate, null);
  });

  it('rejects unusable documents', () => {
    for (const bad of [
      {...doc, amountMinor: 0},
      {...doc, amountMinor: 10.5},
      {...doc, amountMinor: '100'},
      {...doc, type: 'transfer'},
      {...doc, frequency: 'daily'},
      {...doc, startDate: 'soon'},
      {...doc, title: '  '},
      {...doc, endDate: '2025-01-01'},
      {...doc, endDate: 'nope'},
      {...doc, nextDueDate: 'tomorrow'},
    ]) {
      assert.equal(parseRule('r', bad), null);
    }
    assert.equal(parseRule('r', null), null);
  });
});

describe('planRun', () => {
  it('does nothing before the first due date', () => {
    const plan = planRun(rule(), '2026-01-30');
    assert.deepEqual(plan.create, []);
    assert.deepEqual(plan.skipped, []);
    assert.equal(plan.nextDueDate, '2026-01-31');
    assert.equal(plan.finished, false);
  });

  it('creates the occurrence due today and moves on', () => {
    const plan = planRun(rule(), '2026-01-31');
    assert.deepEqual(plan.create, ['2026-01-31']);
    assert.equal(plan.nextDueDate, '2026-02-28');
  });

  it('creates an occurrence up to three days late and skips older ones', () => {
    const weekly = rule({
      frequency: 'weekly',
      startDate: '2026-11-02',
      nextDueDate: '2026-11-02',
    });
    // Today is Nov 17: due Nov 2 and 9 are far too late, Nov 16 is one day late.
    const plan = planRun(weekly, '2026-11-17');
    assert.deepEqual(plan.skipped, ['2026-11-02', '2026-11-09']);
    assert.deepEqual(plan.create, ['2026-11-16']);
    assert.equal(plan.nextDueDate, '2026-11-23');
  });

  it('treats exactly three days late as on time and four as late', () => {
    const r = rule({
      frequency: 'weekly',
      startDate: '2026-11-10',
      nextDueDate: '2026-11-10',
    });
    assert.deepEqual(planRun(r, '2026-11-13').create, ['2026-11-10']);
    assert.deepEqual(planRun(r, '2026-11-14').create, []);
    assert.deepEqual(planRun(r, '2026-11-14').skipped, ['2026-11-10']);
  });

  it('after a long outage creates nothing old and resumes at the right date', () => {
    const plan = planRun(rule(), '2026-11-17');
    assert.deepEqual(plan.create, []);
    assert.equal(plan.skipped.length, 10);
    assert.equal(plan.nextDueDate, '2026-11-30');
  });

  it('stops at the end date and marks the rule finished', () => {
    const r = rule({
      startDate: '2026-01-15',
      nextDueDate: '2026-02-15',
      endDate: '2026-02-20',
    });
    const plan = planRun(r, '2026-02-15');
    assert.deepEqual(plan.create, ['2026-02-15']);
    assert.equal(plan.finished, true);
  });

  it('is finished even with nothing to create once past the end date', () => {
    const r = rule({nextDueDate: '2026-03-31', endDate: '2026-03-01'});
    const plan = planRun(r, '2026-03-10');
    assert.deepEqual(plan.create, []);
    assert.equal(plan.finished, true);
  });

  it('the plan after a run starts where it ended, so a second run is a no-op', () => {
    const first = planRun(rule(), '2026-01-31');
    const second = planRun(
      rule({nextDueDate: first.nextDueDate}),
      '2026-01-31',
    );
    assert.deepEqual(second.create, []);
    assert.deepEqual(second.skipped, []);
    assert.equal(second.nextDueDate, first.nextDueDate);
  });
});

describe('transaction documents', () => {
  it('has the id of the rule and the date', () => {
    assert.equal(
      recurringTransactionId('r1', '2026-02-28'),
      'rec_r1_2026-02-28',
    );
  });

  it('is shaped like an app-written transaction and marks its source', () => {
    const tx = buildTransaction(
      rule({tags: ['home'], description: 'Flat'}),
      'u1',
      '2026-02-28',
      'rec_r1_2026-02-28',
    );
    assert.deepEqual(tx, {
      userId: 'u1',
      documentId: 'rec_r1_2026-02-28',
      title: 'Rent',
      description: 'Flat',
      amount: '15000.00',
      amountMinor: 1500000,
      currency: 'INR',
      category: 'Rent',
      date: '2026-02-28',
      type: 'expense',
      source: 'recurring',
      recurringId: 'r1',
      tags: ['home'],
    });
  });

  it('leaves tags out when there are none', () => {
    const tx = buildTransaction(rule(), 'u1', '2026-02-28', 'x');
    assert.equal('tags' in tx, false);
  });
});
