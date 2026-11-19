import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  guessAmounts,
  guessDate,
  guessMerchant,
  parseReceiptText,
} from './receiptParse';

const NOW = new Date(Date.UTC(2026, 10, 18, 12, 0));

// Zero-decimal currencies. Written in each country's usual style with made-up numbers, not copied
// from real receipts: replace or add real, anonymised samples when the owner has some.
const KONBINI_JPY = `ファミリーマート
2026年11月14日 20:41
おにぎり ¥150
コーヒー ¥120
小計 ¥270
消費税 8% ¥21
合計 ¥291
お預り ¥1,000
お釣り ¥709`;

const CONVENIENCE_KRW = `GS25 강남점
2026-11-14 20:41
삼각김밥 1,500
커피 2,300
합계 3,800
부가세 345
받은금액 5,000
거스름돈 1,200`;

const SHOP_JPY_EN = `TOKYO MART
Date 2026/11/14
Item A 1,200
Item B 780
TOTAL ¥1,980
CASH ¥2,000`;

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

describe('guessAmounts for a zero-decimal currency (exponent 0)', () => {
  it('reads a Japanese receipt: the total, not the tax, change or subtotal', () => {
    const amounts = guessAmounts(KONBINI_JPY, 0);
    assert.equal(amounts[0], '291');
    for (const bad of ['21', '709', '270', '8']) {
      assert.notEqual(amounts[0], bad);
    }
  });

  it('reads a Korean receipt with no currency mark on the lines', () => {
    const amounts = guessAmounts(CONVENIENCE_KRW, 0);
    assert.equal(amounts[0], '3800');
    assert.ok(!amounts.includes('345'));
    assert.ok(!amounts.includes('1200'));
  });

  it('reads an English-labelled yen receipt with comma grouping', () => {
    assert.equal(guessAmounts(SHOP_JPY_EN, 0)[0], '1980');
  });

  it('returns whole numbers with no decimals', () => {
    for (const a of guessAmounts(KONBINI_JPY, 0)) {
      assert.match(a, /^\d+$/);
    }
  });

  it('does not read a fraction as an amount, but accepts .00', () => {
    assert.deepEqual(guessAmounts('Total 8.5', 0), []);
    // A tax rate with a decimal point is no more believable than a bare integer.
    assert.deepEqual(guessAmounts('Rate 10.0%\nTax 8.0%', 0), []);
    assert.deepEqual(guessAmounts('Shop\nCoffee 12.0%', 0), []);
    assert.equal(guessAmounts('Total 1,234.00', 0)[0], '1234');
  });

  it('keeps the upper limit of 10,000,000 whole units', () => {
    assert.equal(guessAmounts('Total ¥10,000,000', 0)[0], '10000000');
    assert.deepEqual(guessAmounts('Total ¥10,000,001', 0), []);
    assert.deepEqual(guessAmounts('Total 99999999999', 0), []);
  });

  it('does not change the default two-decimal reading', () => {
    assert.equal(guessAmounts('Total 1,234.50')[0], '1234.50');
    assert.equal(guessAmounts('Total 1,234.50', 2)[0], '1234.50');
    // The same yen text read as a two-decimal currency keeps the old behaviour.
    assert.equal(guessAmounts(SHOP_JPY_EN)[0], '1980.00');
  });
});

describe('guessDate in Japanese and Korean', () => {
  it('reads 2026年11月14日 and 2026년 11월 14일', () => {
    assert.equal(guessDate('2026年11月14日 20:41', NOW), '2026-11-14');
    assert.equal(guessDate('2026년 11월 14일', NOW), '2026-11-14');
  });

  it('rejects an impossible or future date in that form', () => {
    assert.equal(guessDate('2026年2月31日', NOW), null);
    assert.equal(guessDate('2026年12月30日', NOW), null);
  });

  it('parseReceiptText carries the exponent to the amounts', () => {
    const guess = parseReceiptText(KONBINI_JPY, NOW, 0);
    assert.equal(guess.amounts[0], '291');
    assert.equal(guess.date, '2026-11-14');
    assert.equal(parseReceiptText(KONBINI_JPY, NOW).amounts[0], '291.00');
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
