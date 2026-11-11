import {describe, expect, it} from '@jest/globals';
import {receiptFields, receiptUrlOf} from '../src/utils/receipt';

describe('receiptUrlOf', () => {
  it('reads imageUrl', () => {
    expect(receiptUrlOf({imageUrl: 'https://x/a.jpg'})).toBe('https://x/a.jpg');
  });

  it('falls back to the legacy image field', () => {
    expect(receiptUrlOf({image: 'https://x/b.jpg'})).toBe('https://x/b.jpg');
    expect(receiptUrlOf({imageUrl: null, image: 'https://x/b.jpg'})).toBe(
      'https://x/b.jpg',
    );
  });

  it('prefers imageUrl when both are set', () => {
    expect(
      receiptUrlOf({imageUrl: 'https://x/new.jpg', image: 'https://x/old.jpg'}),
    ).toBe('https://x/new.jpg');
  });

  it('returns null when there is no receipt', () => {
    expect(receiptUrlOf({})).toBeNull();
    expect(receiptUrlOf({imageUrl: null, image: null})).toBeNull();
    expect(receiptUrlOf({imageUrl: '', image: '  '})).toBeNull();
  });
});

describe('receiptFields', () => {
  it('writes the same value to both fields', () => {
    expect(receiptFields('https://x/c.jpg')).toEqual({
      imageUrl: 'https://x/c.jpg',
      image: 'https://x/c.jpg',
    });
  });

  it('clears both fields together', () => {
    expect(receiptFields(null)).toEqual({imageUrl: null, image: null});
    expect(receiptFields('')).toEqual({imageUrl: null, image: null});
  });

  it('a cleared receipt does not come back through the read fallback', () => {
    expect(receiptUrlOf(receiptFields(null))).toBeNull();
  });
});
