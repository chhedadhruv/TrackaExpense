import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {goalDocFields, goalDocUpToDate, planGoalSync} from './goals';
import type {Fields} from './derive';

const goal = (id: string, over: Fields = {}): Fields => ({
  id,
  name: 'Trip',
  description: 'Goa',
  category: 'travel',
  targetDate: '2027-01-01',
  reminderEnabled: false,
  reminderFrequency: null,
  current: 1000.5,
  target: 50000,
  monthly: 2500,
  createdAt: {_seconds: 1, _nanoseconds: 0},
  updatedAt: {_seconds: 2, _nanoseconds: 0},
  ...over,
});

describe('goalDocFields', () => {
  it('copies the legacy fields and adds currency and exact minor amounts', () => {
    const fields = goalDocFields(goal('g1'), 'INR');
    assert.equal(fields.name, 'Trip');
    assert.equal(fields.current, 1000.5);
    assert.equal(fields.currentMinor, 100050);
    assert.equal(fields.targetMinor, 5000000);
    assert.equal(fields.monthlyMinor, 250000);
    assert.equal(fields.currency, 'INR');
    assert.equal('id' in fields, false);
  });

  it('uses the currency exponent and rounds half away from zero', () => {
    assert.equal(
      goalDocFields(goal('g', {current: 0.125}), 'USD').currentMinor,
      13,
    );
    assert.equal(goalDocFields(goal('g', {current: 5}), 'JPY').currentMinor, 5);
  });

  it('leaves out a minor field it cannot convert, and unknown fields', () => {
    const fields = goalDocFields(
      goal('g', {current: 'abc', extra: 'x'}),
      'INR',
    );
    assert.equal('currentMinor' in fields, false);
    assert.equal(fields.targetMinor, 5000000);
    assert.equal('extra' in fields, false);
  });
});

describe('planGoalSync', () => {
  it('writes every goal when there is no previous array (the backfill)', () => {
    const plan = planGoalSync(undefined, [goal('a'), goal('b')], 'INR');
    assert.deepEqual(
      plan.upserts.map(u => u.id),
      ['a', 'b'],
    );
    assert.deepEqual(plan.deletes, []);
  });

  it('writes only the goals that changed', () => {
    const before = [goal('a'), goal('b')];
    const after = [goal('a'), goal('b', {current: 2000})];
    const plan = planGoalSync(before, after, 'INR');
    assert.deepEqual(
      plan.upserts.map(u => u.id),
      ['b'],
    );
    assert.equal(plan.upserts[0].fields.currentMinor, 200000);
    assert.deepEqual(plan.deletes, []);
  });

  it('writes a new goal and deletes only the ones that left the array', () => {
    const plan = planGoalSync(
      [goal('a'), goal('b')],
      [goal('b'), goal('c')],
      'INR',
    );
    assert.deepEqual(
      plan.upserts.map(u => u.id),
      ['c'],
    );
    assert.deepEqual(plan.deletes, ['a']);
  });

  it('does nothing when the array did not change', () => {
    const plan = planGoalSync([goal('a')], [goal('a')], 'INR');
    assert.deepEqual(plan, {upserts: [], deletes: []});
  });

  it('never deletes a goal the previous array did not have', () => {
    // A document the new app just created is not in either array yet; an old app's write that does
    // not know it must not remove it.
    const plan = planGoalSync([goal('a')], [goal('a'), goal('b')], 'INR');
    assert.deepEqual(plan.deletes, []);
  });

  it('empties the goals when the array becomes empty or is removed', () => {
    assert.deepEqual(planGoalSync([goal('a')], [], 'INR').deletes, ['a']);
    assert.deepEqual(planGoalSync([goal('a')], undefined, 'INR').deletes, [
      'a',
    ]);
  });

  it('ignores entries without a usable id and keeps the last of a repeated id', () => {
    const plan = planGoalSync(
      undefined,
      [
        goal(''),
        {name: 'no id'},
        goal('a/b'),
        goal('a'),
        goal('a', {name: 'Second'}),
      ],
      'INR',
    );
    assert.deepEqual(
      plan.upserts.map(u => [u.id, u.fields.name]),
      [['a', 'Second']],
    );
  });

  it('writes nothing for identical arrays whatever the currency', () => {
    const same = planGoalSync([goal('a')], [goal('a')], 'USD');
    assert.deepEqual(same.upserts, []);
  });
});

describe('goalDocUpToDate', () => {
  const fields = goalDocFields(goal('a'), 'INR');
  it('is true for an equal document', () => {
    assert.equal(goalDocUpToDate({...fields}, fields), true);
  });
  it('is false when a value differs or the document has a field the array dropped', () => {
    assert.equal(goalDocUpToDate({...fields, current: 1}, fields), false);
    assert.equal(goalDocUpToDate({...fields, stale: true}, fields), false);
  });
});
