import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {InvitationError, parseRespondInput} from './invitation';

describe('parseRespondInput', () => {
  it('accepts an invitation id with an accept flag', () => {
    assert.deepEqual(parseRespondInput({invitationId: 'abc', accept: true}), {
      invitationId: 'abc',
      accept: true,
    });
    assert.deepEqual(parseRespondInput({invitationId: 'abc', accept: false}), {
      invitationId: 'abc',
      accept: false,
    });
  });

  it('rejects anything else', () => {
    const bad: unknown[] = [
      null,
      'abc',
      [],
      {},
      {invitationId: 'abc'},
      {accept: true},
      {invitationId: '', accept: true},
      {invitationId: 'a/b', accept: true},
      {invitationId: 5, accept: true},
      {invitationId: 'abc', accept: 'true'},
    ];
    for (const input of bad) {
      assert.throws(() => parseRespondInput(input), InvitationError);
    }
  });
});
