import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  InviteLinkError,
  hashToken,
  newToken,
  parseGroupInput,
  parseLinkInput,
} from './inviteLinks';

describe('tokens', () => {
  it('are 22 URL-safe characters (128 random bits) and differ every time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const token = newToken();
      assert.match(token, /^[A-Za-z0-9_-]{22}$/);
      seen.add(token);
    }
    assert.equal(seen.size, 200);
  });

  it('hash to a stable 64-character SHA-256 that never contains the token', () => {
    const token = 'AAAAAAAAAAAAAAAAAAAAAA';
    const hash = hashToken(token);
    assert.equal(hash, hashToken(token));
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.ok(!hash.includes(token));
    assert.notEqual(hash, hashToken('AAAAAAAAAAAAAAAAAAAAAB'));
  });
});

describe('input parsing', () => {
  const code = (fn: () => unknown): string | undefined => {
    try {
      fn();
      return undefined;
    } catch (error) {
      return error instanceof InviteLinkError ? error.code : 'other';
    }
  };

  it('accepts a group id', () => {
    assert.deepEqual(parseGroupInput({groupId: 'abc'}), {groupId: 'abc'});
  });

  it('rejects a missing, empty or path-like group id', () => {
    for (const bad of [
      null,
      [],
      {},
      {groupId: ''},
      {groupId: 'a/b'},
      {groupId: 5},
    ]) {
      assert.equal(
        code(() => parseGroupInput(bad)),
        'invalid-argument',
      );
    }
  });

  it('accepts a group id with a well-formed token', () => {
    assert.deepEqual(
      parseLinkInput({groupId: 'g1', token: newToken()}).groupId,
      'g1',
    );
  });

  it('rejects a token of the wrong length or alphabet', () => {
    for (const token of [
      '',
      'short',
      'A'.repeat(23),
      'A'.repeat(21) + '/',
      'A'.repeat(21) + ' ',
      5,
    ]) {
      assert.equal(
        code(() => parseLinkInput({groupId: 'g1', token})),
        'invalid-argument',
      );
    }
  });
});
