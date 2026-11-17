import {describe, expect, it} from '@jest/globals';
import type {SavingsGoal} from '../src/types';
import {
  chooseGoals,
  goalCurrency,
  goalDocFields,
  goalFromDoc,
  goalsEqual,
  rebaseGoals,
  sortGoals,
} from '../src/utils/goals';

const ts = (ms: number) => ({toMillis: () => ms});

const goal = (id: string, over: Record<string, unknown> = {}): SavingsGoal =>
  ({
    id,
    name: `Goal ${id}`,
    description: '',
    current: 100.5,
    target: 5000,
    monthly: 250,
    category: 'travel',
    targetDate: '',
    reminderEnabled: false,
    reminderFrequency: null,
    createdAt: ts(1000),
    updatedAt: ts(2000),
    ...over,
  } as unknown as SavingsGoal);

describe('goalCurrency', () => {
  it('upper-cases a code and falls back to INR', () => {
    expect(goalCurrency('usd')).toBe('USD');
    expect(goalCurrency(undefined)).toBe('INR');
    expect(goalCurrency('rupee')).toBe('INR');
  });
});

describe('goalDocFields', () => {
  it('copies the legacy fields and adds currency and exact minor amounts', () => {
    const fields = goalDocFields(goal('g1'), 'INR');
    expect(fields).toMatchObject({
      name: 'Goal g1',
      current: 100.5,
      currentMinor: 10050,
      targetMinor: 500000,
      monthlyMinor: 25000,
      currency: 'INR',
    });
    expect('id' in fields).toBe(false);
  });

  it('never writes undefined and leaves out unconvertible minors', () => {
    const fields = goalDocFields(
      goal('g', {description: undefined, current: 'abc'}),
      'INR',
    );
    expect('description' in fields).toBe(false);
    expect('currentMinor' in fields).toBe(false);
    expect(fields.targetMinor).toBe(500000);
  });

  it('uses the currency exponent', () => {
    expect(goalDocFields(goal('g', {current: 0.125}), 'USD').currentMinor).toBe(
      13,
    );
    expect(goalDocFields(goal('g', {current: 5}), 'JPY').currentMinor).toBe(5);
  });
});

describe('goalsEqual', () => {
  it('compares timestamps by value and treats null and missing alike', () => {
    expect(goalsEqual(goal('a'), goal('a', {createdAt: ts(1000)}))).toBe(true);
    expect(goalsEqual(goal('a'), goal('a', {updatedAt: ts(2001)}))).toBe(false);
    expect(
      goalsEqual(
        goal('a', {reminderFrequency: null}),
        goal('a', {reminderFrequency: undefined}),
      ),
    ).toBe(true);
    expect(goalsEqual(goal('a'), goal('a', {current: 1}))).toBe(false);
  });
});

describe('rebaseGoals', () => {
  it('applies one edited goal to the fresh array and leaves the others as the server has them', () => {
    const previous = [goal('a'), goal('b')];
    const next = [goal('a'), goal('b', {current: 999})];
    // Another device changed goal a in the meantime.
    const fresh = [goal('a', {current: 7}), goal('b')];
    const out = rebaseGoals(fresh, previous, next);
    expect(out.goals.map(g => [g.id, g.current])).toEqual([
      ['a', 7],
      ['b', 999],
    ]);
    expect(out.upserts.map(g => g.id)).toEqual(['b']);
    expect(out.deletes).toEqual([]);
  });

  it('appends a new goal and removes a deleted one', () => {
    const previous = [goal('a'), goal('b')];
    const next = [goal('b'), goal('c')];
    const fresh = [goal('a'), goal('b')];
    const out = rebaseGoals(fresh, previous, next);
    expect(out.goals.map(g => g.id)).toEqual(['b', 'c']);
    expect(out.upserts.map(g => g.id)).toEqual(['c']);
    expect(out.deletes).toEqual(['a']);
  });

  it('keeps a goal another device added', () => {
    const previous = [goal('a')];
    const next = [goal('a', {current: 5})];
    const fresh = [goal('a'), goal('z')];
    const out = rebaseGoals(fresh, previous, next);
    expect(out.goals.map(g => g.id)).toEqual(['a', 'z']);
    expect(out.goals[0].current).toBe(5);
  });

  it('is a no-op when nothing changed', () => {
    const out = rebaseGoals([goal('a')], [goal('a')], [goal('a')]);
    expect(out.upserts).toEqual([]);
    expect(out.deletes).toEqual([]);
  });

  it('creates the first goal on an empty array', () => {
    const out = rebaseGoals([], [], [goal('a')]);
    expect(out.goals.map(g => g.id)).toEqual(['a']);
    expect(out.upserts.map(g => g.id)).toEqual(['a']);
  });
});

describe('goalFromDoc and sortGoals', () => {
  it('reads a document with safe defaults and rejects one without a name', () => {
    expect(
      goalFromDoc('g', {name: 'Trip', current: 5, createdAt: ts(1)}),
    ).toMatchObject({
      id: 'g',
      name: 'Trip',
      current: 5,
      target: 0,
      category: 'other',
      reminderEnabled: false,
      reminderFrequency: null,
    });
    expect(goalFromDoc('g', {current: 5})).toBeNull();
    expect(goalFromDoc('g', null)).toBeNull();
  });

  it('orders oldest first with a stable tie-break', () => {
    const sorted = sortGoals([
      goal('b', {createdAt: ts(5)}),
      goal('a', {createdAt: ts(5)}),
      goal('c', {createdAt: ts(1)}),
    ]);
    expect(sorted.map(g => g.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('chooseGoals', () => {
  it('prefers the documents once there are any, else the array', () => {
    const docs = [goal('d')];
    const array = [goal('a')];
    expect(chooseGoals(docs, array)).toBe(docs);
    expect(chooseGoals([], array)).toBe(array);
    expect(chooseGoals(undefined, array)).toBe(array);
  });
});
