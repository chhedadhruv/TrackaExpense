import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  FUN_MESSAGES,
  funContext,
  funDueDate,
  funHourFor,
  funMessage,
} from './fun';

describe('fun nudge', () => {
  it('picks a stable hour between 18 and 21', () => {
    for (let i = 0; i < 50; i += 1) {
      const hour = funHourFor(`user${i}`, '2026-11-18');
      assert.ok(hour >= 18 && hour <= 21);
      assert.equal(hour, funHourFor(`user${i}`, '2026-11-18'));
    }
  });

  it('is due only in the chosen local hour', () => {
    const date = '2026-11-18';
    const hour = funHourFor('u1', date);
    // Wednesday 2026-11-18, India is UTC+5:30: local hour h minute 30 is (h-6) UTC at :00.
    const at = (h: number): number => Date.UTC(2026, 10, 18, h - 6, 0);
    assert.notEqual(
      funDueDate(at(hour) + 30 * 60_000, 'u1', 'Asia/Kolkata'),
      null,
    );
    const other = hour === 18 ? 19 : 18;
    assert.equal(
      funDueDate(at(other) + 30 * 60_000, 'u1', 'Asia/Kolkata'),
      null,
    );
  });

  it('follows the old server tone rules', () => {
    assert.equal(funContext(true, true, 3), 'motivational');
    assert.equal(funContext(false, false, 6), 'funny');
    assert.equal(funContext(false, false, 2), 'motivational');
    assert.equal(funContext(false, true, 0), 'weekend');
    assert.equal(funContext(false, true, 4), 'evening');
  });

  it('chooses a message from the context list, the same each time', () => {
    const a = funMessage('funny', 'u1', '2026-11-18');
    assert.ok(FUN_MESSAGES.funny.includes(a.body));
    assert.deepEqual(a, funMessage('funny', 'u1', '2026-11-18'));
  });

  it('uses no emoji or non-ASCII characters in any message', () => {
    for (const lines of Object.values(FUN_MESSAGES)) {
      for (const line of lines) {
        assert.match(line, /^[\x20-\x7E]+$/);
      }
    }
  });
});
