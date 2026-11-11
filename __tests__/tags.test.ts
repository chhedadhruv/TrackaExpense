import {describe, expect, it} from '@jest/globals';
import {
  MAX_TAGS_PER_TRANSACTION,
  MAX_TAG_LENGTH,
  addTag,
  cleanTag,
  hasTag,
  removeTag,
  sanitizeTags,
  suggestTags,
  tagDocId,
  tagErrorMessage,
  tagKey,
  unknownTags,
} from '../src/utils/tags';

describe('cleanTag and tagKey', () => {
  it('trims, drops a leading hash and collapses spaces', () => {
    expect(cleanTag('  #Goa   Trip ')).toBe('Goa Trip');
    expect(cleanTag('##work')).toBe('work');
    expect(cleanTag('   ')).toBe('');
    expect(cleanTag('#')).toBe('');
  });

  it('compares ignoring case', () => {
    expect(tagKey('Trip')).toBe(tagKey(' #trip '));
    expect(tagKey('Goa Trip')).toBe('goa trip');
  });
});

describe('addTag', () => {
  it('adds a clean tag as typed', () => {
    expect(addTag([], ' #Goa Trip ')).toEqual({tags: ['Goa Trip']});
  });

  it('rejects an empty tag', () => {
    expect(addTag(['a'], '  # ')).toEqual({tags: ['a'], error: 'empty'});
  });

  it('rejects a tag over the length limit but accepts one at the limit', () => {
    const atLimit = 'x'.repeat(MAX_TAG_LENGTH);
    expect(addTag([], atLimit).error).toBeUndefined();
    expect(addTag([], atLimit + 'x')).toEqual({tags: [], error: 'too_long'});
  });

  it('rejects a duplicate ignoring case, and keeps the first spelling', () => {
    expect(addTag(['Trip'], 'trip')).toEqual({
      tags: ['Trip'],
      error: 'duplicate',
    });
  });

  it('stops at the per-transaction limit', () => {
    const full = Array.from(
      {length: MAX_TAGS_PER_TRANSACTION},
      (_, i) => `t${i}`,
    );
    expect(addTag(full, 'extra')).toEqual({tags: full, error: 'limit'});
    // a duplicate is reported as a duplicate even when the list is full
    expect(addTag(full, 'T0').error).toBe('duplicate');
  });

  it('does not change the list it was given', () => {
    const tags = ['a'];
    addTag(tags, 'b');
    expect(tags).toEqual(['a']);
  });
});

describe('removeTag', () => {
  it('removes ignoring case', () => {
    expect(removeTag(['Trip', 'Work'], 'trip')).toEqual(['Work']);
  });

  it('leaves the list alone when the tag is not there', () => {
    expect(removeTag(['Trip'], 'other')).toEqual(['Trip']);
  });
});

describe('sanitizeTags', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(sanitizeTags(undefined)).toEqual([]);
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags('trip')).toEqual([]);
    expect(sanitizeTags({0: 'trip'})).toEqual([]);
  });

  it('keeps clean, distinct strings and drops the rest', () => {
    expect(
      sanitizeTags(['Trip', 'trip', 3, null, '  ', ' #Work ', 'x'.repeat(40)]),
    ).toEqual(['Trip', 'Work']);
  });

  it('keeps at most the per-transaction limit', () => {
    const many = Array.from({length: 12}, (_, i) => `tag${i}`);
    expect(sanitizeTags(many)).toHaveLength(MAX_TAGS_PER_TRANSACTION);
  });
});

describe('suggestTags', () => {
  const known = ['Trip', 'Work', 'Weekend', 'Office lunch', 'Gift'];

  it('offers the first known tags that are not selected when nothing is typed', () => {
    expect(suggestTags(known, '', ['trip'], 3)).toEqual([
      'Work',
      'Weekend',
      'Office lunch',
    ]);
  });

  it('offers tags that start with the text', () => {
    expect(suggestTags(known, 'w', [])).toEqual(['Work', 'Weekend']);
  });

  it('puts tags starting with the text before tags only containing it', () => {
    expect(suggestTags(['Network', 'Work', 'Homework'], 'work', [])).toEqual([
      'Work',
      'Network',
      'Homework',
    ]);
  });

  it('honours the limit', () => {
    expect(suggestTags(['a1', 'a2', 'a3'], 'a', [], 2)).toEqual(['a1', 'a2']);
  });

  it('matches ignoring case and ignores a leading hash', () => {
    expect(suggestTags(known, '#GI', [])).toEqual(['Gift']);
  });

  it('never offers an already selected tag', () => {
    expect(suggestTags(known, 'work', ['WORK'])).toEqual([]);
  });
});

describe('unknownTags', () => {
  it('returns only selected tags missing from the known list, ignoring case', () => {
    expect(unknownTags(['Trip', 'New', 'WORK'], ['trip', 'work'])).toEqual([
      'New',
    ]);
  });
});

describe('hasTag', () => {
  it('finds a tag ignoring case and tolerates documents without tags', () => {
    expect(hasTag({tags: ['Goa Trip']}, 'goa trip')).toBe(true);
    expect(hasTag({tags: ['Goa Trip']}, 'work')).toBe(false);
    expect(hasTag({}, 'work')).toBe(false);
    expect(hasTag({tags: 'work'}, 'work')).toBe(false);
  });
});

describe('tagDocId', () => {
  it('is the same for the same tag in any case', () => {
    expect(tagDocId('Trip')).toBe(tagDocId(' #trip '));
  });

  it('is a valid document id for awkward tags', () => {
    expect(tagDocId('.')).toBe('t_.');
    expect(tagDocId('a/b')).toBe('t_a%2Fb');
    expect(tagDocId('a/b')).not.toContain('/');
  });
});

describe('tagErrorMessage', () => {
  it('has a message for every error', () => {
    for (const error of ['empty', 'too_long', 'limit', 'duplicate'] as const) {
      expect(tagErrorMessage(error).length).toBeGreaterThan(0);
    }
  });
});
