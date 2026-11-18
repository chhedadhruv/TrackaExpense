import {describe, expect, it} from '@jest/globals';
import {
  adjustmentFor,
  catchUpOf,
  isHandMade,
  isSplitCreated,
  isTransferEntry,
  shouldPromptCatchUp,
} from '../src/utils/balanceAdjust';

const hand = (date: string) => ({type: 'expense', date, amountMinor: 100});
const split = (date: string) => ({
  type: 'expense',
  date,
  amountMinor: 500,
  source: 'split',
});

describe('classifying entries', () => {
  it('tells split-created, hand-made and transfer entries apart', () => {
    expect(isSplitCreated({source: 'split'})).toBe(true);
    expect(isSplitCreated({splitRole: 'payer'})).toBe(true);
    expect(isSplitCreated({category: 'Settlement'})).toBe(true);
    expect(isSplitCreated({})).toBe(false);
    expect(isHandMade({})).toBe(true);
    expect(isHandMade({source: 'recurring'})).toBe(false);
    expect(isHandMade({source: 'card_payment'})).toBe(false);
    expect(isHandMade({source: 'balance_adjustment'})).toBe(false);
    expect(isTransferEntry({source: 'balance_adjustment'})).toBe(true);
    expect(isTransferEntry({source: 'card_payment'})).toBe(true);
    expect(isTransferEntry({source: 'split'})).toBe(false);
  });
});

describe('catching up', () => {
  it('finds split entries after the last hand-made one', () => {
    const catchUp = catchUpOf(
      [hand('2026-09-01'), split('2026-09-20'), split('2026-10-05')],
      '2026-11-19',
    );
    expect(catchUp?.lastResetDay).toBe('2026-09-01');
    expect(catchUp?.splitEntries).toHaveLength(2);
    expect(catchUp?.gapDays).toBe(79);
  });

  it('ignores split entries from before the last hand-made entry', () => {
    expect(
      catchUpOf([split('2026-08-01'), hand('2026-09-01')], '2026-11-19'),
    ).toBeNull();
  });

  it('counts an earlier adjustment as a reset point', () => {
    const adjustment = {
      type: 'income',
      date: '2026-10-20',
      amountMinor: 1,
      source: 'balance_adjustment',
    };
    const catchUp = catchUpOf(
      [
        hand('2026-09-01'),
        split('2026-10-05'),
        adjustment,
        split('2026-11-01'),
      ],
      '2026-11-19',
    );
    expect(catchUp?.lastResetDay).toBe('2026-10-20');
    expect(catchUp?.splitEntries).toHaveLength(1);
  });

  it('works when the person never added anything by hand', () => {
    const catchUp = catchUpOf([split('2026-10-01')], '2026-11-19');
    expect(catchUp?.lastResetDay).toBeNull();
    expect(catchUp?.gapDays).toBe(49);
  });

  it('returns null with no split entries', () => {
    expect(catchUpOf([hand('2026-01-01')], '2026-11-19')).toBeNull();
  });
});

describe('when to ask', () => {
  const catchUp = catchUpOf(
    [hand('2026-10-01'), split('2026-10-10')],
    '2026-11-19',
  );
  it('asks after a long enough gap', () => {
    expect(shouldPromptCatchUp(catchUp, '2026-11-19', null)).toBe(true);
  });
  it('does not ask for a short gap', () => {
    const recent = catchUpOf(
      [hand('2026-11-15'), split('2026-11-16')],
      '2026-11-19',
    );
    expect(shouldPromptCatchUp(recent, '2026-11-19', null)).toBe(false);
  });
  it('stays away for a week after Not now', () => {
    expect(shouldPromptCatchUp(catchUp, '2026-11-19', '2026-11-15')).toBe(
      false,
    );
    expect(shouldPromptCatchUp(catchUp, '2026-11-19', '2026-11-10')).toBe(true);
  });
  it('does not ask without split entries', () => {
    expect(shouldPromptCatchUp(null, '2026-11-19', null)).toBe(false);
  });
});

describe('the adjustment', () => {
  it('records the difference exactly, in either direction', () => {
    expect(adjustmentFor(1000.1, '1200.35', 'INR')).toEqual({
      deltaMinor: 20025,
      type: 'income',
      amountMinor: 20025,
    });
    expect(adjustmentFor(500, '320.5', 'INR')).toEqual({
      deltaMinor: -17950,
      type: 'expense',
      amountMinor: 17950,
    });
  });

  it('handles a negative balance', () => {
    expect(adjustmentFor(-200, '50', 'INR')?.deltaMinor).toBe(25000);
  });

  it('returns null when nothing changes or the text is unreadable', () => {
    expect(adjustmentFor(100, '100', 'INR')).toBeNull();
    expect(adjustmentFor(100, 'abc', 'INR')).toBeNull();
    expect(adjustmentFor(undefined, '100', 'INR')).toBeNull();
  });
});
