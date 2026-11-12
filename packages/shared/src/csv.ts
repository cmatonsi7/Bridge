/**
 * A small, strict CSV reader (RFC 4180): quoted fields, doubled quotes, commas and line breaks inside quotes.
 * It also copes with what South African Excel produces: a semicolon delimiter and a byte-order mark.
 */

/** Picks the delimiter from the header line, ignoring anything inside quotes. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]!++;
  }
  if (counts[';']! > counts[',']! && counts[';']! >= counts['\t']!) return ';';
  if (counts['\t']! > counts[',']!) return '\t';
  return ',';
}

export interface ParsedCsv {
  rows: string[][];
  /** Set when the file is malformed (for example an unclosed quote). */
  error: string | null;
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/, ''); // strip a byte-order mark
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // ignore completely blank lines
    if (!(row.length === 1 && row[0]!.trim() === '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      i++;
    } else if (ch === delimiter) {
      endField();
      i++;
    } else if (ch === '\r') {
      i++;
    } else if (ch === '\n') {
      endRow();
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (inQuotes)
    return { rows, error: 'The file has a quotation mark that is never closed. Check the last rows.' };
  if (field !== '' || row.length > 0) endRow();
  return { rows, error: null };
}

/** Wraps a value for CSV output. Also neutralises spreadsheet formulas (=, +, -, @) so a hostile cell can't run in Excel. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: Array<Array<string | number | null | undefined>>): string =>
  rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
