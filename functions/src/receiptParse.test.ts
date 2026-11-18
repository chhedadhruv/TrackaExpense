import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  guessAmounts,
  guessDate,
  guessMerchant,
  parseReceiptText,
} from './receiptParse';

const NOW = new Date(Date.UTC(2026, 10, 18, 12, 0));

const RESTAURANT = `SPICE GARDEN RESTAURANT
12, MG Road, Pune 411001
GSTIN: 27AABCS1234F1Z5
Tel: 020 2567 8901
Bill No: 10458
Date: 14/11/2026   Time: 20:41
Paneer Tikka        2    640.00
Butter Naan         4    180.00
Dal Makhani         1    320.00
Sub Total                1,140.00
CGST 2.5%                  28.50
SGST 2.5%                  28.50
Round off                   0.00
GRAND TOTAL            Rs 1,197.00
Cash                    1,200.00
Change                      3.00
Thank you, visit again`;

const SUPERMARKET = `D-MART
Receipt
Date 03-Nov-2026
MILK 1L                 62.00
BREAD                   45.00
TOTAL
1,23,456.50`;

const CAFE_USD = `Blue Bottle Coffee
Nov 9, 2026
Latte                    $5.50
Tax                      $0.46
Total                    $5.96
VISA ****1234            $5.96`;

describe('guessAmounts', () => {
  it('prefers the grand total over sub total, tax and cash given', () => {
    assert.equal(guessAmounts(RESTAURANT)[0], '1197.00');
  });

  it('reads Indian digit grouping and a total whose figure is on the next line', () => {
    assert.equal(guessAmounts(SUPERMARKET)[0], '123456.50');
  });

  it('reads a dollar receipt and de-duplicates the paid line', () => {
    const amounts = guessAmounts(CAFE_USD);
    assert.equal(amounts[0], '5.96');
    assert.equal(amounts.filter(a => a === '5.96').length, 1);
  });

  it('never proposes a phone number, a bill number or a GST number', () => {
    const amounts = guessAmounts(RESTAURANT);
    for (const bad of ['2567.00', '10458.00', '411001.00']) {
      assert.ok(!amounts.includes(bad));
    }
  });

  it('falls back to the largest decimal figure when there is no total word', () => {
    assert.equal(guessAmounts('Shop\nTea 12.00\nSnack 48.50')[0], '48.50');
  });

  it('reads European grouping', () => {
    assert.equal(guessAmounts('Gesamtbetrag 1.234,50')[0], '1234.50');
  });

  it('returns nothing for text with no amounts and caps the list at three', () => {
    assert.deepEqual(guessAmounts('hello world'), []);
    const many = Array.from({length: 8}, (_, i) => `Total ${i + 1}.00`).join(
      '\n',
    );
    assert.equal(guessAmounts(many).length, 3);
  });

  it('ignores absurd values', () => {
    assert.deepEqual(guessAmounts('Total 99999999999.00'), []);
  });
});

describe('guessDate', () => {
  it('reads day-first numeric dates', () => {
    assert.equal(guessDate('Date: 14/11/2026', NOW), '2026-11-14');
    assert.equal(guessDate('05.11.26', NOW), '2026-11-05');
    assert.equal(guessDate('03/11/2026', NOW), '2026-11-03');
  });

  it('falls back to month first when the second number cannot be a month', () => {
    assert.equal(guessDate('11/14/2026', NOW), '2026-11-14');
  });

  it('reads ISO, day-month-name and month-name-day forms', () => {
    assert.equal(guessDate('2026-11-02', NOW), '2026-11-02');
    assert.equal(guessDate('Date 03-Nov-2026', NOW), '2026-11-03');
    assert.equal(guessDate('3rd November 2026', NOW), '2026-11-03');
    assert.equal(guessDate('Nov 9, 2026', NOW), '2026-11-09');
  });

  it('rejects impossible, future and very old dates', () => {
    assert.equal(guessDate('31/02/2026', NOW), null);
    assert.equal(guessDate('20/11/2026', NOW), null);
    assert.equal(guessDate('01/01/2015', NOW), null);
  });

  it('takes the first plausible date in the text', () => {
    assert.equal(
      guessDate('Printed 99/99/2026\nDate 10/11/2026\n12/11/2026', NOW),
      '2026-11-10',
    );
  });
});

describe('guessMerchant', () => {
  it('takes the first shop-like line and skips labels and addresses with digits', () => {
    assert.equal(guessMerchant(RESTAURANT), 'SPICE GARDEN RESTAURANT');
    assert.equal(guessMerchant(SUPERMARKET), 'D-MART');
    assert.equal(guessMerchant(CAFE_USD), 'Blue Bottle Coffee');
  });

  it('skips receipt labels and contact lines', () => {
    assert.equal(
      guessMerchant('TAX INVOICE\nwww.shop.com\n+91 98765 43210\nGreen Grocer'),
      'Green Grocer',
    );
  });

  it('is null when nothing qualifies, and shortens long names', () => {
    assert.equal(guessMerchant('12345\n---\n99'), null);
    assert.equal(guessMerchant('A'.repeat(80))?.length, 50);
  });
});

describe('parseReceiptText', () => {
  it('combines the three guesses', () => {
    assert.deepEqual(parseReceiptText(RESTAURANT, NOW), {
      amounts: guessAmounts(RESTAURANT),
      date: '2026-11-14',
      merchant: 'SPICE GARDEN RESTAURANT',
    });
  });

  it('is empty for text that is not a receipt', () => {
    assert.deepEqual(parseReceiptText('', NOW), {
      amounts: [],
      date: null,
      merchant: null,
    });
  });
});
