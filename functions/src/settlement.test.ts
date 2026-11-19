import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  SettlementError,
  parseDeleteInput,
  parseRecordInput,
} from './settlement';

const valid = {
  groupId: 'g1',
  fromEmail: 'a@x.com',
  toEmail: 'b@x.com',
  amount: '10.50',
  note: ' Dinner ',
  includeInTransactions: true,
  requestId: 'req-12345678',
};

describe('parseRecordInput', () => {
  it('accepts a valid request and trims text', () => {
    assert.deepEqual(parseRecordInput(valid), {
      ...valid,
      note: 'Dinner',
      cardId: null,
    });
  });

  it('reads an optional card id and refuses a bad one', () => {
    assert.equal(parseRecordInput({...valid, cardId: 'c1'}).cardId, 'c1');
    assert.equal(parseRecordInput({...valid, cardId: null}).cardId, null);
    assert.throws(
      () => parseRecordInput({...valid, cardId: 'a/b'}),
      SettlementError,
    );
    assert.throws(
      () => parseRecordInput({...valid, cardId: 5}),
      SettlementError,
    );
  });

  it('treats a missing note as empty and a missing include flag as false', () => {
    const rest: Record<string, unknown> = {...valid};
    delete rest.note;
    delete rest.includeInTransactions;
    const parsed = parseRecordInput(rest);
    assert.equal(parsed.note, '');
    assert.equal(parsed.includeInTransactions, false);
  });

  it('rejects bad requests', () => {
    const bad: unknown[] = [
      null,
      'x',
      [],
      {...valid, groupId: ''},
      {...valid, groupId: 'a/b'},
      {...valid, fromEmail: 'nope'},
      {...valid, toEmail: 5},
      {...valid, amount: undefined},
      {...valid, amount: {}},
      {...valid, note: 5},
      {...valid, note: 'x'.repeat(201)},
      {...valid, requestId: 'short'},
      {...valid, requestId: 'has/slash-1234'},
    ];
    for (const input of bad) {
      assert.throws(() => parseRecordInput(input), SettlementError);
    }
  });
});

describe('parseDeleteInput', () => {
  it('needs a group id and a split id without slashes', () => {
    assert.deepEqual(parseDeleteInput({groupId: 'g', splitId: 's'}), {
      groupId: 'g',
      splitId: 's',
    });
    for (const input of [
      null,
      {},
      {groupId: 'g'},
      {groupId: 'g', splitId: 'a/b'},
      {groupId: '', splitId: 's'},
    ]) {
      assert.throws(() => parseDeleteInput(input), SettlementError);
    }
  });
});
