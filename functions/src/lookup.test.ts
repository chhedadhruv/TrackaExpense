import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {LookupInputError, MAX_LOOKUP_ITEMS, parseLookupInput} from './lookup';

describe('parseLookupInput', () => {
  it('accepts emails and phones and trims them', () => {
    assert.deepEqual(
      parseLookupInput({emails: [' a@x.com '], phones: ['123']}),
      {emails: ['a@x.com'], phones: ['123']},
    );
  });

  it('treats a missing list as empty', () => {
    assert.deepEqual(parseLookupInput({}), {emails: [], phones: []});
    assert.deepEqual(parseLookupInput({emails: ['a@x.com']}), {
      emails: ['a@x.com'],
      phones: [],
    });
  });

  it('rejects anything that is not an object of string lists', () => {
    for (const bad of [null, undefined, 'a@x.com', 5, [], ['a@x.com']]) {
      assert.throws(() => parseLookupInput(bad), LookupInputError);
    }
    assert.throws(
      () => parseLookupInput({emails: 'a@x.com'}),
      LookupInputError,
    );
    assert.throws(() => parseLookupInput({emails: [1]}), LookupInputError);
    assert.throws(() => parseLookupInput({phones: [null]}), LookupInputError);
  });

  it('limits the total number of lookups per request', () => {
    const emails = Array.from(
      {length: MAX_LOOKUP_ITEMS},
      (_, i) => `${i}@x.com`,
    );
    assert.equal(parseLookupInput({emails}).emails.length, MAX_LOOKUP_ITEMS);
    assert.throws(
      () => parseLookupInput({emails, phones: ['1']}),
      LookupInputError,
    );
  });
});
