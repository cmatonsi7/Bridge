import { z } from 'zod';
import { PROVINCES, SPORTS } from './athlete.js';
import { parseCsv, toCsv } from './csv.js';
import { ORGANISATION_TYPES, ORGANISATION_TYPE_LABELS, type OrganisationType } from './roles.js';
import { unclaimedOrganisationSchema, type UnclaimedOrganisationFields } from './onboarding.js';

export const IMPORT_MAX_ROWS = 500;

/** Columns of the import template, in order. Only name, type and province are essential. */
export const IMPORT_COLUMNS = [
  'name',
  'type',
  'province',
  'city',
  'sports',
  'school_number',
  'contact_email',
  'contact_phone',
  'website',
  'description',
  'source',
] as const;
type Column = (typeof IMPORT_COLUMNS)[number];

/** The template staff download. The example row is rejected on upload, so it can never be imported by mistake. */
export const EXAMPLE_ROW_MARKER = '(delete this row)';
export const importTemplateCsv = () =>
  toCsv([
    [...IMPORT_COLUMNS],
    [
      `Example High School ${EXAMPLE_ROW_MARKER}`,
      'School',
      'Gauteng',
      'Soweto',
      'Football; Netball',
      '700123456',
      'office@example-school.co.za',
      '011 123 4567',
      'https://www.example-school.co.za',
      'A public high school.',
      'Gauteng Department of Education school list, 2026',
    ],
  ]);

const HEADER_ALIASES: Record<string, Column> = {
  name: 'name',
  school: 'name',
  school_name: 'name',
  organisation: 'name',
  organization: 'name',
  organisation_name: 'name',
  type: 'type',
  organisation_type: 'type',
  category: 'type',
  province: 'province',
  city: 'city',
  town: 'city',
  suburb: 'city',
  city_town: 'city',
  sports: 'sports',
  sport: 'sports',
  school_number: 'school_number',
  school_no: 'school_number',
  emis: 'school_number',
  emis_number: 'school_number',
  school_code: 'school_number',
  contact_email: 'contact_email',
  email: 'contact_email',
  official_email: 'contact_email',
  email_address: 'contact_email',
  contact_phone: 'contact_phone',
  phone: 'contact_phone',
  telephone: 'contact_phone',
  tel: 'contact_phone',
  phone_number: 'contact_phone',
  website: 'website',
  web: 'website',
  url: 'website',
  description: 'description',
  about: 'description',
  source: 'source',
  source_note: 'source',
  data_source: 'source',
};
const headerKey = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');

const PROVINCE_ALIASES: Record<string, string> = {
  gp: 'Gauteng',
  wc: 'Western Cape',
  kzn: 'KwaZulu-Natal',
  ec: 'Eastern Cape',
  fs: 'Free State',
  lp: 'Limpopo',
  mp: 'Mpumalanga',
  nw: 'North West',
  nc: 'Northern Cape',
};
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const PROVINCE_BY_KEY = new Map<string, string>([
  ...PROVINCES.map((p) => [squash(p), p] as const),
  ...Object.entries(PROVINCE_ALIASES),
]);
const TYPE_BY_KEY = new Map<string, OrganisationType>([
  ...ORGANISATION_TYPES.map((t) => [squash(t), t] as const),
  ...ORGANISATION_TYPES.map((t) => [squash(ORGANISATION_TYPE_LABELS[t]), t] as const),
  ['university', 'tertiary'],
  ['college', 'tertiary'],
  ['tertiary', 'tertiary'],
  ['highschool', 'school'],
  ['primaryschool', 'school'],
  ['secondaryschool', 'school'],
  ['sportsclub', 'club'],
  ['facility', 'sports_facility'],
  ['provider', 'service_provider'],
]);
const SPORT_BY_KEY = new Map<string, string>(SPORTS.map((s) => [squash(s), s]));
const FREE_MAIL = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|webmail)\./i;

export type ImportRowStatus = 'ready' | 'warning' | 'duplicate' | 'error';

export interface ImportRow {
  /** Line number in the file (the header is line 1). */
  line: number;
  name: string;
  city: string;
  province: string;
  status: ImportRowStatus;
  messages: string[];
  /** Present only for rows that can be imported. */
  data: UnclaimedOrganisationFields | null;
}

export interface ImportAnalysis {
  /** A problem that stops the whole file, such as a missing name column. */
  fatal: string | null;
  rows: ImportRow[];
  counts: Record<ImportRowStatus, number>;
  importable: number;
}

export interface ExistingOrganisationKey {
  id: string;
  name: string;
  province: string | null;
  schoolNumber: string | null;
}

const normaliseName = (s: string) => squash(s);
const normaliseNumber = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  type: 'Type',
  province: 'Province',
  city: 'City',
  sports: 'Sports',
  schoolNumber: 'School number',
  contactEmail: 'Email',
  contactPhone: 'Phone',
  website: 'Website',
  description: 'Description',
  sourceNote: 'Source',
};

/**
 * Reads a CSV and judges every row without writing anything. Used for the preview and, again, by the server
 * when the import is confirmed: the server never trusts what the browser says about a row.
 */
export function analyseImport(
  csv: string,
  defaultSource: string,
  existing: ExistingOrganisationKey[],
): ImportAnalysis {
  const empty = (fatal: string): ImportAnalysis => ({
    fatal,
    rows: [],
    counts: { ready: 0, warning: 0, duplicate: 0, error: 0 },
    importable: 0,
  });
  if (defaultSource.trim().length < 3) return empty('Say where this list came from (at least 3 characters).');

  const parsed = parseCsv(csv);
  if (parsed.error) return empty(parsed.error);
  if (parsed.rows.length < 2)
    return empty('The file has no rows to import. It needs a header row and at least one school.');
  if (parsed.rows.length - 1 > IMPORT_MAX_ROWS) {
    return empty(
      `The file has ${parsed.rows.length - 1} rows. The limit is ${IMPORT_MAX_ROWS} per upload: split it into smaller files.`,
    );
  }

  const header = parsed.rows[0]!.map((h) => HEADER_ALIASES[headerKey(h)]);
  const col = new Map<Column, number>();
  header.forEach((c, i) => c && !col.has(c) && col.set(c, i));
  for (const required of ['name', 'province'] as const) {
    if (!col.has(required))
      return empty(`The file needs a “${required}” column. Download the template to see the layout.`);
  }
  const cell = (r: string[], c: Column) => (col.has(c) ? (r[col.get(c)!] ?? '').trim() : '');

  const numbers = new Map<string, string>(); // normalised school number -> display
  const names = new Map<string, string>(); // normalised name|province -> display
  for (const e of existing) {
    if (e.schoolNumber) numbers.set(normaliseNumber(e.schoolNumber), e.name);
    names.set(`${normaliseName(e.name)}|${squash(e.province ?? '')}`, e.name);
  }
  const seenNumbers = new Map<string, number>();
  const seenNames = new Map<string, number>();

  const rows: ImportRow[] = parsed.rows.slice(1).map((r, i): ImportRow => {
    const line = i + 2;
    const messages: string[] = [];
    const base = { line, name: cell(r, 'name'), city: cell(r, 'city'), province: cell(r, 'province') };
    const fail = (...m: string[]): ImportRow => ({
      ...base,
      status: 'error',
      messages: [...messages, ...m],
      data: null,
    });

    if (base.name.toLowerCase().includes(EXAMPLE_ROW_MARKER))
      return fail('This is the example row from the template. Delete it.');

    // type: blank means "school" is not assumed; the template says to choose one
    const typeRaw = cell(r, 'type');
    const type = TYPE_BY_KEY.get(squash(typeRaw));
    if (!type)
      return fail(
        typeRaw
          ? `Type “${typeRaw}” is not recognised. Use School, Club, Academy, Sports facility, Programme provider, University / tertiary institution, Service provider, Federation or Other.`
          : 'Type is missing.',
      );

    const province = PROVINCE_BY_KEY.get(squash(base.province));
    if (!province)
      return fail(base.province ? `Province “${base.province}” is not recognised.` : 'Province is missing.');

    // sports: unknown ones are dropped with a warning rather than blocking the school
    const sports: string[] = [];
    for (const raw of cell(r, 'sports')
      .split(/[;|,]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      const match = SPORT_BY_KEY.get(squash(raw));
      if (!match) messages.push(`Sport “${raw}” is not on SportBridge’s list and was left out.`);
      else if (!sports.includes(match)) sports.push(match);
    }

    let website = cell(r, 'website');
    if (website && !/^https?:\/\//i.test(website)) {
      website = `https://${website.replace(/^\/+/, '')}`;
      messages.push('Added https:// to the website address.');
    }
    const email = cell(r, 'contact_email');
    if (email && FREE_MAIL.test(email))
      messages.push('This looks like a personal email address. Use the school’s official one.');

    const result = unclaimedOrganisationSchema.safeParse({
      name: base.name,
      type,
      description: cell(r, 'description'),
      contactEmail: email,
      contactPhone: cell(r, 'contact_phone'),
      website,
      city: base.city,
      province,
      sports,
      ageGroups: [],
      offerings: [],
      facilities: [],
      schoolNumber: cell(r, 'school_number'),
      sourceNote: cell(r, 'source') || defaultSource.trim(),
    });
    if (!result.success) {
      return fail(
        ...result.error.issues.map(
          (is) => `${FIELD_LABELS[String(is.path[0])] ?? String(is.path[0] ?? 'Row')}: ${is.message}`,
        ),
      );
    }
    const data = result.data as UnclaimedOrganisationFields;
    if (!data.city) return fail('City is missing.');

    // duplicates: against what is already on SportBridge, and against earlier lines of this file
    const numKey = data.schoolNumber ? normaliseNumber(data.schoolNumber) : '';
    const nameKey = `${normaliseName(data.name)}|${squash(province)}`;
    if (numKey && numbers.has(numKey))
      return {
        ...base,
        status: 'duplicate',
        messages: [...messages, `School number already on SportBridge (${numbers.get(numKey)}).`],
        data: null,
      };
    if (names.has(nameKey))
      return {
        ...base,
        status: 'duplicate',
        messages: [...messages, `Already on SportBridge (${names.get(nameKey)}, ${province}).`],
        data: null,
      };
    if (numKey && seenNumbers.has(numKey))
      return {
        ...base,
        status: 'duplicate',
        messages: [...messages, `Same school number as line ${seenNumbers.get(numKey)}.`],
        data: null,
      };
    if (seenNames.has(nameKey))
      return {
        ...base,
        status: 'duplicate',
        messages: [...messages, `Same name and province as line ${seenNames.get(nameKey)}.`],
        data: null,
      };
    if (numKey) seenNumbers.set(numKey, line);
    seenNames.set(nameKey, line);

    return { ...base, status: messages.length ? 'warning' : 'ready', messages, data };
  });

  const counts = { ready: 0, warning: 0, duplicate: 0, error: 0 };
  for (const r of rows) counts[r.status]++;
  return { fatal: null, rows, counts, importable: counts.ready + counts.warning };
}

/** The file staff download after an import: one row per school with its claim code. Shown once, never stored. */
export const claimCodesCsv = (
  items: Array<{ name: string; city: string; province: string; claimCode: string }>,
) =>
  toCsv([
    ['school', 'city', 'province', 'claim_code'],
    ...items.map((i) => [i.name, i.city, i.province, i.claimCode]),
  ]);

/** importBatches/{id}: a record of one upload, so it can be reviewed or undone. Staff-readable, server-written. */
export interface ImportBatchDoc {
  createdAt: string;
  createdBy: string;
  sourceNote: string;
  fileName: string | null;
  rowCount: number;
  createdCount: number;
  skippedCount: number;
  /** importing: written before the schools are, so a half-finished import can still be undone. */
  status: 'importing' | 'active' | 'undone';
  orgIds: string[];
  undoneAt?: string | null;
  undoneBy?: string | null;
  removedCount?: number;
  keptCount?: number;
}

export const importRequestSchema = z.object({
  csv: z.string().min(1, 'Choose a file').max(1_500_000, 'The file is too large'),
  source: z.string().trim().min(3, 'Say where this list came from').max(200),
  fileName: z.string().trim().max(200).optional().nullable(),
});
export type ImportRequest = z.input<typeof importRequestSchema>;
