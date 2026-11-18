import {describe, expect, it} from '@jest/globals';
import {bankOf, parseSms, smsId} from '../src/utils/sms/parse';
import {cleanMerchant} from '../src/utils/sms/common';

/**
 * Fixtures are written in the styles the banks use, with made-up numbers and names. They are not
 * copies of real messages: real samples must be added here as they are collected.
 */
const at = new Date(2026, 10, 16, 9, 30);
const read = (sender: string, body: string) =>
  parseSms({sender, body, receivedAt: at});

describe('HDFC', () => {
  it('UPI debit to a VPA', () => {
    expect(
      read(
        'VM-HDFCBK',
        'Rs.500.00 debited from a/c **1234 on 15-11-26 to VPA coffee.shop@okhdfc (UPI Ref No 123456789012). Not you? Call 18002586161',
      ),
    ).toMatchObject({
      bank: 'hdfc',
      direction: 'debit',
      amountMinor: 50000,
      amount: '500.00',
      currency: 'INR',
      merchant: 'Coffee Shop',
      account: '1234',
      date: '2026-11-15',
      method: 'upi',
      reference: '123456789012',
    });
  });

  it('Sent ... To MERCHANT On date', () => {
    expect(
      read(
        'AD-HDFCBK',
        'Sent Rs.1,250.00 From HDFC Bank A/C *1234 To GREEN GROCER On 15/11/26 Ref 987654321098',
      ),
    ).toMatchObject({
      direction: 'debit',
      amount: '1250.00',
      merchant: 'Green Grocer',
      date: '2026-11-15',
    });
  });

  it('card spend', () => {
    expect(
      read(
        'VM-HDFCBK',
        'Spent Rs.2499 On HDFC Bank Card 5678 At BOOK STORE On 2026-11-14:10:11:12.Avl Bal Rs.50,000.00',
      ),
    ).toMatchObject({
      direction: 'debit',
      amount: '2499.00',
      merchant: 'Book Store',
      account: '5678',
      method: 'card',
      date: '2026-11-14',
    });
  });

  it('credit by a UPI sender, ignoring the balance', () => {
    expect(
      read(
        'VM-HDFCBK',
        'Rs. 25000.00 credited to HDFC Bank A/c XX1234 on 01-11-26 by A/c linked to VPA friend.name@ybl (UPI Ref No 111122223333). Avl bal Rs 80,000.00',
      ),
    ).toMatchObject({
      direction: 'credit',
      amount: '25000.00',
      merchant: 'Friend Name',
      date: '2026-11-01',
    });
  });

  it('NEFT deposit with a compact date', () => {
    expect(
      read(
        'VM-HDFCBK',
        'Update! INR 85,000.00 deposited in HDFC Bank A/c XX1234 on 01NOV26 for NEFT Cr-HDFC0001234-ACME LTD-SALARY NOV. Avl bal INR 90,000.00',
      ),
    ).toMatchObject({
      direction: 'credit',
      amount: '85000.00',
      merchant: 'Acme Ltd',
      date: '2026-11-01',
      method: 'transfer',
    });
  });
});

describe('ICICI', () => {
  it('debit where the word credited belongs to the shop', () => {
    expect(
      read(
        'AX-ICICIB',
        'ICICI Bank Acct XX123 debited for Rs 500.00 on 15-Nov-26; CITY BAKERY credited. UPI:123456789012. Call 18002662 for dispute.',
      ),
    ).toMatchObject({
      bank: 'icici',
      direction: 'debit',
      amount: '500.00',
      merchant: 'City Bakery',
      account: '123',
      date: '2026-11-15',
      reference: '123456789012',
    });
  });

  it('credit with Info and a balance that must not be read as the amount', () => {
    expect(
      read(
        'VK-ICICIB',
        'ICICI Bank Acct XX123 credited with Rs. 25,000.00 on 01-Nov-26. Info: NEFT-ACME LTD. Available Bal: Rs. 1,20,000.00',
      ),
    ).toMatchObject({
      direction: 'credit',
      amount: '25000.00',
      merchant: 'Acme Ltd',
      date: '2026-11-01',
    });
  });

  it('card spend at a merchant', () => {
    expect(
      read(
        'VM-ICICIB',
        'INR 1,250.00 spent on ICICI Bank Card XX1234 on 15-Nov-26 at ONLINE STORE. Avl Limit: INR 98,750.00. If not you, call 18002662',
      ),
    ).toMatchObject({
      direction: 'debit',
      amount: '1250.00',
      merchant: 'Online Store',
      method: 'card',
      account: '1234',
    });
  });
});

describe('SBI', () => {
  it('UPI debit without a currency marker', () => {
    expect(
      read(
        'AX-SBIUPI',
        'Dear UPI user A/C X1234 debited by 500.0 on date 15Nov26 trf to CORNER SHOP Refno 123456789012. If not u? call 1800111109',
      ),
    ).toMatchObject({
      bank: 'sbi',
      direction: 'debit',
      amount: '500.00',
      merchant: 'Corner Shop',
      date: '2026-11-15',
      reference: '123456789012',
    });
  });

  it('credit transaction wording', () => {
    expect(
      read(
        'SBIINB',
        'Your A/C XXXXXXXX1234 has a credit transaction of Rs. 25,000.00 on 01/11/26. Total Avail.bal Rs.60,000.00',
      ),
    ).toMatchObject({
      direction: 'credit',
      amount: '25000.00',
      date: '2026-11-01',
    });
  });

  it('credit card spend is a debit, not a credit', () => {
    expect(
      read(
        'SBICRD',
        'Rs.1250.00 spent on your SBI Credit Card ending 1234 at AMAZON on 15-11-26. Trxn. not done by you?',
      ),
    ).toMatchObject({direction: 'debit', merchant: 'Amazon', account: '1234'});
  });

  it('transfer from a sender', () => {
    expect(
      read(
        'SBIINB',
        'A/C X1234 credited by Rs 500 on 01Nov26 transfer from RAVI KUMAR Ref No 123456789012',
      ),
    ).toMatchObject({
      direction: 'credit',
      amount: '500.00',
      merchant: 'Ravi Kumar',
    });
  });
});

describe('Axis', () => {
  it('UPI P2M debit', () => {
    expect(
      read(
        'AD-AXISBK',
        'INR 500.00 debited A/c no. XX1234 15-11-26, 10:11:12 UPI/P2M/123456789012/TEA POINT. Not you? SMS BLOCK UPI to 18001035577',
      ),
    ).toMatchObject({
      bank: 'axis',
      direction: 'debit',
      amount: '500.00',
      merchant: 'Tea Point',
      method: 'upi',
      date: '2026-11-15',
      reference: '123456789012',
    });
  });

  it('card spend', () => {
    expect(
      read(
        'AX-AXISBK',
        'Spent Card no. XX1234 INR 1250 15-11-26 10:11:12 FLIGHT BOOKING Avl Lmt INR 90000 SMS BLOCK 1234 to 5676782',
      ),
    ).toMatchObject({
      direction: 'debit',
      amount: '1250.00',
      merchant: 'Flight Booking',
      method: 'card',
    });
  });

  it('credit', () => {
    expect(
      read(
        'AD-AXISBK',
        'INR 25000.00 credited to A/c no. XX1234 01-11-26, 09:00:00 from ACME LTD. Avl Bal INR 40000',
      ),
    ).toMatchObject({
      direction: 'credit',
      amount: '25000.00',
      merchant: 'Acme Ltd',
    });
  });
});

describe('Kotak', () => {
  it('UPI sent', () => {
    expect(
      read(
        'VM-KOTAKB',
        'Sent Rs.500.00 from Kotak Bank AC X1234 to juice.bar@okaxis on 15-11-26.UPI Ref 123456789012. Not you, https://kotak.com/KBANKT/Fraud',
      ),
    ).toMatchObject({
      bank: 'kotak',
      direction: 'debit',
      amount: '500.00',
      merchant: 'Juice Bar',
      reference: '123456789012',
      date: '2026-11-15',
    });
  });

  it('UPI received', () => {
    expect(
      read(
        'VM-KOTAKB',
        'Received Rs.2,000.00 in your Kotak Bank AC X1234 from sender.name@ybl on 01-11-26.UPI Ref 555566667777.',
      ),
    ).toMatchObject({
      direction: 'credit',
      amount: '2000.00',
      merchant: 'Sender Name',
    });
  });
});

describe('generic fallback', () => {
  it('reads an unknown bank with common wording and uses the arrival day without a date', () => {
    expect(
      read(
        'JD-NEWBNK',
        'Rs. 99.50 debited from your account ending 4321 for payment at MOBILE RECHARGE',
      ),
    ).toMatchObject({
      bank: 'generic',
      direction: 'debit',
      amount: '99.50',
      account: '4321',
      date: '2026-11-16',
    });
  });

  it('reads a pasted message with no sender by the bank name in the text', () => {
    expect(
      parseSms({
        body: 'HDFC Bank: Rs.40.00 debited from a/c **1234 on 15-11-26 to VPA x@upi',
      }),
    ).toMatchObject({bank: 'hdfc', amount: '40.00'});
  });

  it('reads a dollar card spend', () => {
    expect(
      read(
        'XX-BANK',
        'USD 12.99 spent on card XX1234 at STREAMING SERVICE on 15-11-26',
      ),
    ).toMatchObject({currency: 'USD', amount: '12.99', amountMinor: 1299});
  });
});

describe('messages that are not transactions', () => {
  const rejected: [string, string][] = [
    [
      'otp',
      '123456 is your OTP for transaction of Rs.500.00 at SHOP. Do not share with anyone. -HDFC Bank',
    ],
    [
      'login otp',
      'Your one time password is 889900. Valid for 10 minutes. ICICI Bank',
    ],
    [
      'promo',
      'Congratulations! You are pre-approved for a personal loan of Rs.5,00,000. Apply now at http://bank.example/loan',
    ],
    [
      'due reminder',
      'Your credit card statement is generated. Total amount due Rs.12,340.00, due date 05-12-26. Pay now to avoid charges. AXIS BANK',
    ],
    [
      'mandate',
      'Rs.499.00 will be debited from your a/c XX1234 on 20-11-26 for NETFLIX under e-mandate. HDFC Bank',
    ],
    [
      'collect request',
      'SHOP has requested money from you Rs.500.00 on UPI. Approve in your UPI app. ICICI Bank',
    ],
    [
      'failed',
      'Your UPI payment of Rs.500.00 to SHOP has failed. Amount not debited. SBI',
    ],
    [
      'balance only',
      'Avl Bal in a/c XX1234 is Rs.12,345.67 as on 15-11-26. KOTAK BANK',
    ],
    ['empty', '   '],
    [
      'no amount',
      'Your account has been credited. Thank you for banking with us.',
    ],
  ];
  it.each(rejected)('rejects %s', (_name, body) => {
    expect(read('VM-BANK', body)).toBeNull();
  });
});

describe('details', () => {
  it('a body with no date and no arrival time cannot be dated', () => {
    expect(
      parseSms({sender: 'VM-HDFCBK', body: 'Rs.500 debited from a/c XX1234'}),
    ).toBeNull();
  });

  it('rejects an impossible date text and falls back to the arrival day', () => {
    expect(
      read(
        'VM-HDFCBK',
        'Rs.500.00 debited from a/c **1234 on 31-02-26 to VPA x@upi',
      )?.date,
    ).toBe('2026-11-16');
  });

  it('gives the same id for the same message and a different one otherwise', () => {
    const base = {sender: 'VM-HDFCBK', body: 'Rs.1 debited', receivedAt: at};
    expect(smsId(base)).toBe(smsId({...base}));
    expect(smsId(base)).not.toBe(smsId({...base, body: 'Rs.2 debited'}));
    expect(smsId(base)).not.toBe(
      smsId({...base, receivedAt: new Date(2026, 10, 17)}),
    );
  });

  it('finds the bank from the sender first', () => {
    expect(bankOf('VM-HDFCBK', 'ICICI Bank ...')).toBe('hdfc');
    expect(bankOf(undefined, 'Kotak Mahindra Bank ...')).toBe('kotak');
    expect(bankOf('XX-OTHER', 'hello')).toBe('generic');
  });

  it('cleans merchant names', () => {
    expect(cleanMerchant('VPA shop.name@okhdfc')).toBe('Shop Name');
    expect(cleanMerchant('9876543210@ybl')).toBeNull();
    expect(cleanMerchant('X')).toBeNull();
    expect(cleanMerchant('MIXED Case Shop')).toBe('MIXED Case Shop');
    expect(cleanMerchant('A'.repeat(80))?.length).toBe(50);
  });
});
