import {describe, expect, it} from '@jest/globals';
import {
  addDays,
  buildRecurringWrite,
  occurrenceAt,
  occurrenceFrom,
  parseRecurringDoc,
  type RecurringDocument,
  type RecurringForm,
} from '../src/utils/recurring';

const form: RecurringForm = {
  title: ' Rent ',
  description: ' Flat ',
  type: 'expense',
  category: 'Rent',
  frequency: 'monthly',
  startDate: '2026-12-31',
  hasEnd: false,
  endDate: '',
  amountText: '15000.50',
  currency: 'INR',
  enabled: true,
};

const existing: RecurringDocument = {
  id: 'r1',
  title: 'Rent',
  description: '',
  type: 'expense',
  category: 'Rent',
  amountMinor: 1500050,
  currency: 'INR',
  frequency: 'monthly',
  startDate: '2026-12-31',
  endDate: null,
  nextDueDate: '2027-02-28',
  timeZone: 'Asia/Kolkata',
  enabled: true,
  finished: false,
};

describe('occurrences', () => {
  it('match the server rules for clamping and year ends', () => {
    const monthly = {frequency: 'monthly' as const, startDate: '2026-01-31'};
    expect(occurrenceAt(monthly, 1)).toBe('2026-02-28');
    expect(occurrenceAt(monthly, 2)).toBe('2026-03-31');
    expect(occurrenceAt(monthly, 25)).toBe('2028-02-29');
    expect(
      occurrenceAt({frequency: 'weekly', startDate: '2026-11-02'}, 9),
    ).toBe('2027-01-04');
    expect(
      occurrenceAt({frequency: 'yearly', startDate: '2028-02-29'}, 1),
    ).toBe('2029-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('occurrenceFrom finds the first one on or after a date', () => {
    const monthly = {frequency: 'monthly' as const, startDate: '2026-01-31'};
    expect(occurrenceFrom(monthly, '2026-02-28')).toBe('2026-02-28');
    expect(occurrenceFrom(monthly, '2026-03-01')).toBe('2026-03-31');
    expect(occurrenceFrom(monthly, '2025-01-01')).toBe('2026-01-31');
  });
});

describe('parseRecurringDoc', () => {
  const doc = {
    title: 'Rent',
    type: 'expense',
    category: 'Rent',
    amountMinor: 1500000,
    frequency: 'weekly',
    startDate: '2026-11-2',
  };

  it('reads a stored rule and defaults the next date to the start', () => {
    expect(parseRecurringDoc('r', doc)).toMatchObject({
      id: 'r',
      startDate: '2026-11-02',
      nextDueDate: '2026-11-02',
      currency: 'INR',
      enabled: true,
      endDate: null,
      finished: false,
    });
  });

  it('rejects unusable documents', () => {
    for (const bad of [
      {...doc, amountMinor: 0},
      {...doc, amountMinor: 1.5},
      {...doc, type: 'x'},
      {...doc, frequency: 'daily'},
      {...doc, startDate: 'soon'},
      {...doc, title: ' '},
      {...doc, endDate: 'nope'},
    ]) {
      expect(parseRecurringDoc('r', bad)).toBeNull();
    }
    expect(parseRecurringDoc('r', null)).toBeNull();
  });
});

describe('buildRecurringWrite', () => {
  it('converts the amount exactly, trims text and starts at the first occurrence from today', () => {
    const out = buildRecurringWrite(form, 'Asia/Kolkata', '2026-11-17');
    expect(out).toEqual({
      ok: true,
      data: {
        title: 'Rent',
        description: 'Flat',
        type: 'expense',
        category: 'Rent',
        amountMinor: 1500050,
        currency: 'INR',
        frequency: 'monthly',
        startDate: '2026-12-31',
        endDate: null,
        nextDueDate: '2026-12-31',
        timeZone: 'Asia/Kolkata',
        enabled: true,
      },
    });
  });

  it('never starts in the past: a past start date moves to the first occurrence from today', () => {
    const out = buildRecurringWrite(
      {...form, startDate: '2026-01-31'},
      'Asia/Kolkata',
      '2026-11-17',
    );
    expect(out.ok && out.data.nextDueDate).toBe('2026-11-30');
  });

  it('keeps the next date when only other fields change, and moves it when the schedule changes', () => {
    const same = buildRecurringWrite(
      {...form, amountText: '16000'},
      'Asia/Kolkata',
      '2026-11-17',
      existing,
    );
    expect(same.ok && same.data.nextDueDate).toBe('2027-02-28');
    const changed = buildRecurringWrite(
      {...form, frequency: 'weekly'},
      'Asia/Kolkata',
      '2026-11-17',
      existing,
    );
    expect(changed.ok && changed.data.nextDueDate).toBe('2026-12-31');
  });

  it('keeps the rule time zone when editing', () => {
    const out = buildRecurringWrite(form, 'America/New_York', '2026-11-17', {
      ...existing,
      timeZone: 'Asia/Tokyo',
    });
    expect(out.ok && out.data.timeZone).toBe('Asia/Tokyo');
  });

  it('checks the title, category, amount and dates', () => {
    const run = (patch: Partial<RecurringForm>) =>
      buildRecurringWrite({...form, ...patch}, 'Asia/Kolkata', '2026-11-17').ok;
    expect(run({title: '  '})).toBe(false);
    expect(run({title: 'x'.repeat(101)})).toBe(false);
    expect(run({category: ''})).toBe(false);
    expect(run({amountText: ''})).toBe(false);
    expect(run({amountText: '0'})).toBe(false);
    expect(run({amountText: 'abc'})).toBe(false);
    expect(run({startDate: ''})).toBe(false);
    expect(run({hasEnd: true, endDate: ''})).toBe(false);
    expect(run({hasEnd: true, endDate: '2026-01-01'})).toBe(false);
    expect(run({hasEnd: true, endDate: '2027-06-30'})).toBe(true);
  });
});
