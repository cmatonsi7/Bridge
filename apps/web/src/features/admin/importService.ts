import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { ImportBatchDoc, ImportRequest, ImportRowStatus } from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import { apiFetch } from '../../lib/apiClient';
import type { Loadable } from '../athlete/athleteService';

/** One line of the preview. The server never sends the parsed data back, only what staff need to judge the row. */
export interface PreviewRow {
  line: number;
  name: string;
  city: string;
  province: string;
  status: ImportRowStatus;
  messages: string[];
}
export interface ImportPreview {
  counts: Record<ImportRowStatus, number>;
  importable: number;
  rows: PreviewRow[];
}
export interface ImportResult {
  batchId: string;
  created: Array<{ id: string; name: string; city: string; province: string; claimCode: string }>;
  skipped: PreviewRow[];
}

/** Staff only: the server re-checks every row and nothing is trusted from the browser. */
export const previewImport = (req: ImportRequest) =>
  apiFetch<ImportPreview>('/admin/imports/preview', { method: 'POST', json: req });
export const runImport = (req: ImportRequest) =>
  apiFetch<ImportResult>('/admin/imports', { method: 'POST', json: req });
export const undoImport = (batchId: string) =>
  apiFetch<{ removed: number; kept: string[] }>(`/admin/imports/${batchId}/undo`, { method: 'POST' });

export type BatchWithId = ImportBatchDoc & { id: string };

/** The most recent uploads, newest first. Only administrators can read these. */
export function useImportBatches(): Loadable<BatchWithId[]> {
  const [state, setState] = useState<Loadable<BatchWithId[]>>({ status: 'loading' });
  useEffect(() => {
    let q;
    try {
      q = query(collection(requireDb(), 'importBatches'), orderBy('createdAt', 'desc'), limit(20));
    } catch {
      setState({
        status: 'error',
        message: 'We couldn’t load earlier imports. Check your connection and refresh.',
      });
      return;
    }
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as ImportBatchDoc) })),
        }),
      () =>
        setState({ status: 'error', message: 'We couldn’t load earlier imports. You may not have access.' }),
    );
  }, []);
  return state;
}

/** Reads a chosen file as text. FileReader works everywhere, including the test environment. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('We couldn’t read that file.'));
    reader.readAsText(file);
  });
}

/** Saves text as a file. The byte-order mark makes Excel read accented names correctly. */
export function downloadCsv(filename: string, text: string) {
  const blob = new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
