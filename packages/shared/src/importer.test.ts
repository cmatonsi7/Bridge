import { describe, expect, it } from 'vitest';
import { csvCell, detectDelimiter, parseCsv, toCsv } from './csv.js';
import {
  IMPORT_COLUMNS,
  analyseImport,
  claimCodesCsv,
  importTemplateCsv,
  type ExistingOrganisationKey,
} from './importer.js';

const HEADER =
  'name,type,province,city,sports,school_number,contact_email,contact_phone,website,description,source';
const SRC = 'Gauteng schools list, Nov 2026';
const run = (rows: string[], existing: ExistingOrganisationKey[] = [], source = SRC) =>
  analyseImport([HEADER, ...rows].join('\n'), source, existing);

describe('parseCsv', () => {
  it('reads quoted fields, doubled quotes, commas and line breaks inside quotes', () => {
    const { rows, error } = parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",z');
    expect(error).toBeNull();
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ]);
  });
  it('copes with Windows line endings, a byte-order mark and blank lines', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2\r\n\r\n3,4\r\n').rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
  it('detects the semicolon delimiter South African Excel produces, and tabs', () => {
    expect(detectDelimiter('name;type;province')).toBe(';');
    expect(detectDelimiter('name\ttype\tprovince')).toBe('\t');
    expect(detectDelimiter('name,type,province')).toBe(',');
    expect(detectDelimiter('"a;b",c,d')).toBe(',');
    expect(parseCsv('name;type\nSoweto High;School').rows[1]).toEqual(['Soweto High', 'School']);
  });
  it('reports an unclosed quotation mark instead of swallowing the rest of the file', () => {
    expect(parseCsv('a,b\n"oops,1').error).toMatch(/never closed/);
  });
});

describe('csv output', () => {
  it('quotes awkward cells and neutralises spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(null)).toBe('');
    expect(
      toCsv([
        ['a', 'b'],
        ['1', '2'],
      ]),
    ).toBe('a,b\r\n1,2\r\n');
  });
  it('writes the claim codes file with a header', () => {
    expect(
      claimCodesCsv([
        { name: 'Soweto High', city: 'Soweto', province: 'Gauteng', claimCode: 'SB-7K4M-9XQ2' },
      ]),
    ).toBe('school,city,province,claim_code\r\nSoweto High,Soweto,Gauteng,SB-7K4M-9XQ2\r\n');
  });
});

describe('analyseImport', () => {
  it('accepts a good row and normalises it', () => {
    const a = run([
      'Soweto High School,School,gauteng,Soweto,Football; netball,700123456,OFFICE@sowetohigh.edu.za,011 123 4567,https://sowetohigh.edu.za,A school.,',
    ]);
    expect(a.fatal).toBeNull();
    expect(a.rows[0]).toMatchObject({ line: 2, status: 'ready', messages: [] });
    expect(a.rows[0]!.data).toMatchObject({
      name: 'Soweto High School',
      type: 'school',
      province: 'Gauteng',
      sports: ['Football', 'Netball'],
      contactEmail: 'office@sowetohigh.edu.za',
      contactPhone: '0111234567',
      schoolNumber: '700123456',
      sourceNote: SRC,
    });
    expect(a.importable).toBe(1);
  });

  it('understands type and province however they are written, including abbreviations', () => {
    const a = run([
      'Berea Primary,Primary school,KZN,Durban,,,,,,,',
      'UCT Sports,university,Western Cape,Cape Town,,,,,,,',
      'Joburg Lions,Sports club,GP,Joburg,,,,,,,',
      'UKZN Sport,University / tertiary institution,kwazulu natal,Durban,,,,,,,',
    ]);
    expect(a.rows.map((r) => r.status)).toEqual(['ready', 'ready', 'ready', 'ready']);
    expect(a.rows.map((r) => r.data!.type)).toEqual(['school', 'tertiary', 'club', 'tertiary']);
    expect(a.rows.map((r) => r.data!.province)).toEqual([
      'KwaZulu-Natal',
      'Western Cape',
      'Gauteng',
      'KwaZulu-Natal',
    ]);
  });

  it('flags errors with a reason, and never imports them', () => {
    const a = run([
      ',School,Gauteng,Soweto,,,,,,,',
      'No Province,School,,Soweto,,,,,,,',
      'Bad Province,School,Narnia,Soweto,,,,,,,',
      'Bad Type,Warehouse,Gauteng,Soweto,,,,,,,',
      'Bad Email,School,Gauteng,Soweto,,,not-an-email,,,,',
      'No City,School,Gauteng,,,,,,,,',
    ]);
    expect(a.rows.map((r) => r.status)).toEqual(Array(6).fill('error'));
    expect(a.rows[1]!.messages[0]).toBe('Province is missing.');
    expect(a.rows[2]!.messages[0]).toMatch(/“Narnia” is not recognised/);
    expect(a.rows[3]!.messages[0]).toMatch(/Type “Warehouse”/);
    expect(a.rows[4]!.messages.join(' ')).toMatch(/Email/);
    expect(a.rows.every((r) => r.data === null)).toBe(true);
    expect(a.importable).toBe(0);
  });

  it('warns, but still imports, when a sport is unknown, a website lacks https, or an email looks personal', () => {
    const a = run([
      'Chess Academy,Academy,Gauteng,Pretoria,Chess; Football,,principal@gmail.com,,www.chessacademy.co.za,,',
    ]);
    expect(a.rows[0]!.status).toBe('warning');
    expect(a.rows[0]!.data).toMatchObject({
      sports: ['Football'],
      website: 'https://www.chessacademy.co.za',
    });
    expect(a.rows[0]!.messages.join(' ')).toMatch(/“Chess” is not on SportBridge’s list/);
    expect(a.rows[0]!.messages.join(' ')).toMatch(/personal email/);
    expect(a.importable).toBe(1);
  });

  it('rejects the template example row so it cannot be imported by mistake', () => {
    const lines = importTemplateCsv().trim().split(/\r?\n/);
    const a = analyseImport(lines.join('\n'), SRC, []);
    expect(a.rows[0]!.status).toBe('error');
    expect(a.rows[0]!.messages[0]).toMatch(/example row/);
  });

  it('catches duplicates against what is already on SportBridge, by school number or by name and province', () => {
    const existing: ExistingOrganisationKey[] = [
      { id: 'x', name: 'Soweto High School', province: 'Gauteng', schoolNumber: '700123456' },
    ];
    const a = run(
      [
        'Different Name,School,Gauteng,Soweto,,700-123-456,,,,,',
        'SOWETO  HIGH SCHOOL,School,gauteng,Soweto,,,,,,,',
        'Soweto High School,School,Western Cape,Cape Town,,,,,,,',
      ],
      existing,
    );
    expect(a.rows.map((r) => r.status)).toEqual(['duplicate', 'duplicate', 'ready']);
    expect(a.rows[0]!.messages[0]).toMatch(/School number already on SportBridge/);
    expect(a.rows[1]!.messages[0]).toMatch(/Already on SportBridge/);
  });

  it('catches duplicates within the file itself, pointing at the earlier line', () => {
    const a = run([
      'Camps Bay High,School,Western Cape,Cape Town,,CB1,,,,,',
      'Camps Bay High,School,Western Cape,Cape Town,,,,,,,',
      'Another One,School,Western Cape,Cape Town,,CB1,,,,,',
    ]);
    expect(a.rows.map((r) => r.status)).toEqual(['ready', 'duplicate', 'duplicate']);
    expect(a.rows[1]!.messages[0]).toBe('Same name and province as line 2.');
    expect(a.rows[2]!.messages[0]).toBe('Same school number as line 2.');
    expect(a.counts).toEqual({ ready: 1, warning: 0, duplicate: 2, error: 0 });
  });

  it('uses a row’s own source when it has one, otherwise the list’s source', () => {
    const a = run([
      'Alpha School,School,Gauteng,Soweto,,,,,,,Phoned the school',
      'Beta School,School,Gauteng,Soweto,,,,,,,',
    ]);
    expect(a.rows[0]!.data!.sourceNote).toBe('Phoned the school');
    expect(a.rows[1]!.data!.sourceNote).toBe(SRC);
  });

  it('accepts alternative column names and a different column order', () => {
    const a = analyseImport('Province,School Name,Town,Category\nGauteng,Soweto High,Soweto,School', SRC, []);
    expect(a.fatal).toBeNull();
    expect(a.rows[0]).toMatchObject({ status: 'ready', name: 'Soweto High' });
  });

  it('refuses the whole file when it cannot work', () => {
    expect(analyseImport('type,province\nSchool,Gauteng', SRC, []).fatal).toMatch(/“name” column/);
    expect(analyseImport('name,type\nAlpha School,School', SRC, []).fatal).toMatch(/“province” column/);
    expect(analyseImport(HEADER, SRC, []).fatal).toMatch(/no rows/);
    expect(analyseImport(`${HEADER}\nAlpha School,School,Gauteng,Soweto,,,,,,,`, '', []).fatal).toMatch(
      /where this list came from/,
    );
    expect(analyseImport('', SRC, []).fatal).toBeTruthy();
  });

  it('enforces the 500-row limit', () => {
    const many = Array.from({ length: 501 }, (_, i) => `School ${i},School,Gauteng,Soweto,,,,,,,`);
    expect(run(many).fatal).toMatch(/limit is 500/);
    expect(run(many.slice(0, 500)).fatal).toBeNull();
  });

  it('the template downloads with the columns the importer expects', () => {
    expect(importTemplateCsv().split(/\r?\n/)[0]).toBe(IMPORT_COLUMNS.join(','));
  });
});
