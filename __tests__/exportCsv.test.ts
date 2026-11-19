import {describe, expect, it} from '@jest/globals';
import {
  CSV_BOM,
  buildSplitsCsv,
  buildTransactionsCsv,
  exportFileName,
  textCell,
  type ExportSplit,
  type ExportTransaction,
} from '../src/utils/exportCsv';

const ts = (iso: string) => ({toDate: () => new Date(iso)});
const rowsOf = (csv: string): string[] =>
  csv.slice(CSV_BOM.length).split('\r\n').filter(Boolean);

describe('textCell', () => {
  it('quotes commas, quotes and line breaks and doubles quotes', () => {
    expect(textCell('a,b')).toBe('"a,b"');
    expect(textCell('say "hi"')).toBe('"say ""hi"""');
    expect(textCell('two\nlines')).toBe('"two\nlines"');
    expect(textCell('plain')).toBe('plain');
    expect(textCell(null)).toBe('');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(textCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(textCell('+91 98765')).toBe("'+91 98765");
    expect(textCell('-1')).toBe("'-1");
    expect(textCell('@cmd')).toBe("'@cmd");
    expect(textCell('=1,2')).toBe('"\'=1,2"');
  });
});

describe('buildTransactionsCsv', () => {
  const base: ExportTransaction = {
    title: 'Lunch, with team',
    description: 'He said "nice"',
    type: 'expense',
    category: 'Food',
    amount: '150.5',
    amountMinor: 15050,
    currency: 'INR',
    date: '2026-11-05',
    createdAt: ts('2026-11-05T10:00:00Z'),
    tags: ['work', 'Work', 'team'],
  };

  it('starts with the byte order mark and the header, and ends with a CRLF', () => {
    const csv = buildTransactionsCsv([base], 'INR');
    expect(csv.startsWith(CSV_BOM + 'Date,Title,Type')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes exact amounts, the day, tags and escaped text', () => {
    const [, row] = rowsOf(buildTransactionsCsv([base], 'INR'));
    expect(row).toBe(
      '2026-11-05,"Lunch, with team",expense,Food,150.50,INR,work; team,"He said ""nice""",Cash / UPI',
    );
  });

  it('names the card a transaction was paid with', () => {
    const csv = buildTransactionsCsv(
      [
        {...base, cardId: 'c1'},
        {...base, cardId: 'gone'},
      ],
      'INR',
      {c1: 'HDFC 1234'},
    );
    const rows = rowsOf(csv);
    expect(rows[0].endsWith(',Payment Method')).toBe(true);
    expect(rows[1].endsWith(',HDFC 1234')).toBe(true);
    expect(rows[2].endsWith(',Card')).toBe(true);
  });

  it('uses the stored text date, padding old unpadded dates, else the creation day', () => {
    const rows = rowsOf(
      buildTransactionsCsv(
        [
          {...base, date: '2025-5-4'},
          {...base, date: undefined, createdAt: ts('2026-01-02T12:00:00Z')},
        ],
        'INR',
      ),
    );
    expect(rows[1].startsWith('2025-05-04,')).toBe(true);
    expect(rows[2].startsWith('2026-01-02,')).toBe(true);
  });

  it('falls back to the legacy amount text and to the profile currency', () => {
    const [, row] = rowsOf(
      buildTransactionsCsv(
        [{title: 'Old', amount: '12.3', date: '2024-01-01'}],
        'INR',
      ),
    );
    expect(row).toBe('2024-01-01,Old,,,12.30,INR,,,Cash / UPI');
  });

  it('keeps an unconvertible amount as typed rather than dropping it', () => {
    const [, row] = rowsOf(
      buildTransactionsCsv(
        [{title: 'Odd', amount: '1e400', date: '2024-01-01'}],
        'INR',
      ),
    );
    expect(row.split(',')[4]).toBe('1e400');
  });

  it('protects titles that look like formulas', () => {
    const [, row] = rowsOf(
      buildTransactionsCsv([{...base, title: '=HYPERLINK("x")'}], 'INR'),
    );
    expect(row).toContain('"\'=HYPERLINK(""x"")"');
  });

  it('exports every row it is given, in order', () => {
    const many = Array.from({length: 120}, (_, i) => ({
      ...base,
      title: `T${i}`,
    }));
    const rows = rowsOf(buildTransactionsCsv(many, 'INR'));
    expect(rows).toHaveLength(121);
    expect(rows[120].split(',')[1]).toBe('T119');
  });
});

describe('buildSplitsCsv', () => {
  const split: ExportSplit = {
    title: 'Dinner',
    category: 'Food',
    amount: '100',
    amountMinor: 10000,
    currency: 'INR',
    date: ts('2026-11-06T18:00:00Z'),
    paidBy: {name: 'Asha', email: 'asha@example.com'},
    splitUsers: [
      {email: 'asha@example.com'},
      {email: 'ravi@example.com'},
      {email: 'me@example.com'},
    ],
  };

  it('gives your share in minor units that add up, and marks settlements', () => {
    const rows = rowsOf(
      buildSplitsCsv(
        [
          split,
          {
            title: 'Settled',
            amountMinor: 5000,
            currency: 'INR',
            type: 'settlement',
            createdAt: ts('2026-11-07T10:00:00Z'),
            paidBy: {email: 'me@example.com'},
            splitUsers: [{email: 'asha@example.com'}],
          },
        ],
        'ME@example.com',
        'INR',
      ),
    );
    expect(rows[1]).toBe('2026-11-06,Dinner,Asha,Food,100.00,33.33,equal,No');
    expect(rows[2]).toBe('2026-11-07,Settled,me@example.com,,50.00,,equal,Yes');
  });

  it('leaves the share empty when you are not in the split', () => {
    const [, row] = rowsOf(buildSplitsCsv([split], 'other@example.com', 'INR'));
    expect(row.split(',')[5]).toBe('');
  });
});

describe('exportFileName', () => {
  it('is safe and stamped', () => {
    const name = exportFileName(
      'Trip / Goa: 2026!',
      new Date(2026, 10, 18, 21, 5, 9),
    );
    expect(name).toBe('Trip_Goa_2026_2026-11-18_21-05-09.csv');
    expect(exportFileName('???', new Date(2026, 10, 18, 1, 2, 3))).toBe(
      'export_2026-11-18_01-02-03.csv',
    );
  });
});
