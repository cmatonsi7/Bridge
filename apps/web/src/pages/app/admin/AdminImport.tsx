import { useRef, useState } from 'react';
import {
  IMPORT_MAX_ROWS,
  SPORTS,
  claimCodesCsv,
  importTemplateCsv,
  toCsv,
  type ImportRowStatus,
} from '@sportbridge/shared';
import { ApiError } from '../../../lib/apiClient';
import { useToast } from '../../../components/Toast';
import {
  downloadCsv,
  previewImport,
  readFileText,
  runImport,
  undoImport,
  useImportBatches,
  type BatchWithId,
  type ImportPreview,
  type ImportResult,
} from '../../../features/admin/importService';

const STATUS: Record<ImportRowStatus, { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'ok' },
  warning: { label: 'Ready, with a note', cls: 'pending' },
  duplicate: { label: 'Duplicate: skipped', cls: 'info' },
  error: { label: 'Error: skipped', cls: 'pending' },
};
const MAX_BYTES = 1_400_000;
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });

/** Staff: add many schools and organisations from a spreadsheet, with a full preview and an undo. */
export default function AdminImport() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState('');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState('');
  const batches = useImportBatches();

  const fail = (err: unknown) =>
    setError(
      err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong. Try again.',
    );

  async function check() {
    if (!file) return;
    setBusy('preview');
    setError('');
    setPreview(null);
    setResult(null);
    try {
      if (file.size > MAX_BYTES)
        throw new Error(
          `That file is too large. Keep it to ${IMPORT_MAX_ROWS} rows; split bigger lists into several files.`,
        );
      const text = await readFileText(file);
      setCsv(text);
      setPreview(await previewImport({ csv: text, source, fileName: file.name }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    if (!preview || !file) return;
    const n = preview.importable;
    if (
      !window.confirm(
        `Add ${n} ${n === 1 ? 'school or organisation' : 'schools and organisations'} to SportBridge? Duplicates and rows with errors will be skipped.`,
      )
    )
      return;
    setBusy('import');
    setError('');
    try {
      const r = await runImport({ csv, source, fileName: file.name });
      setResult(r);
      setPreview(null);
      setFile(null);
      setCsv('');
      if (fileRef.current) fileRef.current.value = '';
      toast(`Imported ${r.created.length}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function undo(id: string, label: string) {
    if (
      !window.confirm(
        `Undo ${label}? Schools nobody has claimed yet are removed. Schools that were already claimed stay.`,
      )
    )
      return;
    try {
      const r = await undoImport(id);
      toast(`Removed ${r.removed}${r.kept.length ? `, kept ${r.kept.length} already claimed` : ''}`);
      if (result?.batchId === id) setResult(null);
    } catch (err) {
      fail(err);
    }
  }

  const rows = preview
    ? problemsOnly
      ? preview.rows.filter((r) => r.status !== 'ready')
      : preview.rows
    : [];

  return (
    <>
      <div className="sb-card sb-form-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>1. Get the template</h2>
        <button
          type="button"
          className="sb-btn"
          onClick={() => downloadCsv('sportbridge-import-template.csv', importTemplateCsv())}
        >
          Download template
        </button>
        <ul className="sb-meta" style={{ lineHeight: 1.7, marginTop: 12, paddingLeft: 18 }}>
          <li>
            Fill it in with Excel or Google Sheets, then save or download it as <b>CSV</b>. Comma or semicolon
            both work.
          </li>
          <li>
            <b>name, type and province</b> are essential. Add the city too, as every school needs a town.
          </li>
          <li>
            <b>sports:</b> separate with a semicolon, from this list: {SPORTS.join(', ')}. Anything else is
            left out, with a note.
          </li>
          <li>
            Use the school’s <b>main office</b> email and phone, not a named person’s. Delete the example row.
          </li>
          <li>
            Up to <b>{IMPORT_MAX_ROWS} rows</b> per upload. Nothing is saved until you review the preview and
            confirm.
          </li>
        </ul>
      </div>

      <div className="sb-card sb-form-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>2. Upload your list</h2>
        <div className="sb-form-grid">
          <div className="sb-field">
            <label htmlFor="imp-file">CSV file</label>
            <input
              id="imp-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
                setError('');
              }}
            />
          </div>
          <div className="sb-field">
            <label htmlFor="imp-source">Where did this list come from?</label>
            <input
              id="imp-source"
              value={source}
              maxLength={200}
              placeholder="e.g. Gauteng Department of Education school list, 2026"
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p className="sb-form-status err" role="alert">
            {error}
          </p>
        )}
        <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="sb-btn primary"
            disabled={!file || source.trim().length < 3 || busy !== null}
            onClick={() => void check()}
          >
            {busy === 'preview' ? 'Checking…' : 'Check the file'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="sb-card sb-form-card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>3. Review before anything is saved</h2>
          <div className="sb-pill-row" role="status" style={{ marginBottom: 10 }}>
            <span className="v-badge ok">{preview.counts.ready} ready</span>
            <span className="v-badge pending">{preview.counts.warning} with a note</span>
            <span className="v-badge info">{preview.counts.duplicate} duplicates</span>
            <span className="v-badge pending">{preview.counts.error} errors</span>
          </div>
          <label className="auth-consent" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={problemsOnly}
              onChange={(e) => setProblemsOnly(e.target.checked)}
            />
            <span>Show only rows that need attention</span>
          </label>
          <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #edf0ee', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10 }}>Line</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>School</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 12 }} className="sb-meta">
                      Nothing needs attention.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.line} style={{ borderTop: '1px solid #edf0ee', verticalAlign: 'top' }}>
                      <td style={{ padding: 10 }}>{r.line}</td>
                      <td style={{ padding: 10 }}>
                        <b>{r.name || '(no name)'}</b>
                        <div className="sb-meta">{[r.city, r.province].filter(Boolean).join(', ')}</div>
                      </td>
                      <td style={{ padding: 10 }}>
                        <span className={`v-badge ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                        {r.messages.map((m) => (
                          <div className="sb-meta" key={m}>
                            {m}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="sb-form-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <button
              type="button"
              className="sb-btn primary"
              disabled={preview.importable === 0 || busy !== null}
              onClick={() => void doImport()}
            >
              {busy === 'import'
                ? 'Importing…'
                : `Import ${preview.importable} ${preview.importable === 1 ? 'school' : 'schools'}`}
            </button>
            {preview.importable === 0 && (
              <span className="sb-meta">
                Nothing in this file can be imported. Fix the errors and upload it again.
              </span>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="sb-member-notice" role="status" style={{ marginBottom: 16 }}>
          <div>
            <strong>
              Imported {result.created.length}, skipped {result.skipped.length}
            </strong>
            <span style={{ display: 'block', margin: '6px 0' }}>
              <b>The claim codes are available only now.</b> They are not stored and can’t be looked up later.
              Download the file and give each school its code. If you lose it, create a new code for a school
              on the Schools &amp; organisations tab.
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                type="button"
                className="sb-btn primary"
                onClick={() => downloadCsv('claim-codes.csv', claimCodesCsv(result.created))}
              >
                Download claim codes
              </button>
              {result.skipped.length > 0 && (
                <button
                  type="button"
                  className="sb-btn"
                  onClick={() =>
                    downloadCsv(
                      'skipped-rows.csv',
                      toCsv([
                        ['line', 'school', 'result', 'problems'],
                        ...result.skipped.map((s) => [
                          s.line,
                          s.name,
                          STATUS[s.status].label,
                          s.messages.join(' '),
                        ]),
                      ]),
                    )
                  }
                >
                  Download skipped rows
                </button>
              )}
              <button
                type="button"
                className="sb-btn"
                onClick={() => void undo(result.batchId, 'this import')}
              >
                Undo this import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sb-section-title" style={{ margin: '24px 0 12px' }}>
        <h2>Earlier imports</h2>
      </div>
      {batches.status === 'loading' ? (
        <p className="sb-meta">Loading…</p>
      ) : batches.status === 'error' ? (
        <div className="sb-card sb-empty" role="alert">
          {batches.message}
        </div>
      ) : batches.data.length === 0 ? (
        <div className="sb-card sb-empty">No imports yet.</div>
      ) : (
        <div className="sb-card" style={{ padding: 0 }}>
          <ul className="sb-activity" aria-label="Earlier imports">
            {batches.data.map((b: BatchWithId) => (
              <li key={b.id}>
                <span>
                  <b>{b.fileName ?? 'Spreadsheet'}</b> · {b.createdCount} added, {b.skippedCount} skipped
                  <span className="sb-meta" style={{ display: 'block' }}>
                    {when(b.createdAt)} · {b.sourceNote}
                    {b.status === 'undone'
                      ? ` · undone (${b.removedCount ?? 0} removed, ${b.keptCount ?? 0} kept)`
                      : ''}
                    {b.status === 'importing' ? ' · unfinished' : ''}
                  </span>
                </span>
                {b.status !== 'undone' && (
                  <button
                    type="button"
                    className="sb-btn"
                    onClick={() => void undo(b.id, `the import of ${b.fileName ?? 'this spreadsheet'}`)}
                  >
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
