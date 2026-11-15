import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../lib/apiClient';
import * as is from '../features/admin/importService';
import type { BatchWithId, ImportPreview, ImportResult } from '../features/admin/importService';
import AdminImport from '../pages/app/admin/AdminImport';

const st = { batches: [] as BatchWithId[] };
const downloaded: Array<{ name: string; text: string }> = [];

vi.mock('../features/admin/importService', async () => {
  const actual = await vi.importActual<typeof import('../features/admin/importService')>(
    '../features/admin/importService',
  );
  return {
    ...actual,
    previewImport: vi.fn(),
    runImport: vi.fn(),
    undoImport: vi.fn(async () => ({ removed: 2, kept: [] })),
    useImportBatches: () => ({ status: 'ready', data: st.batches }),
    downloadCsv: vi.fn((name: string, text: string) => {
      downloaded.push({ name, text });
    }),
  };
});

const preview = (over: Partial<ImportPreview> = {}): ImportPreview => ({
  counts: { ready: 2, warning: 1, duplicate: 1, error: 1 },
  importable: 3,
  rows: [
    {
      line: 2,
      name: 'Soweto High School',
      city: 'Soweto',
      province: 'Gauteng',
      status: 'ready',
      messages: [],
    },
    {
      line: 3,
      name: 'Chess Academy',
      city: 'Pretoria',
      province: 'Gauteng',
      status: 'warning',
      messages: ['Sport “Chess” is not on SportBridge’s list and was left out.'],
    },
    {
      line: 4,
      name: 'Parktown Girls',
      city: 'Johannesburg',
      province: 'Gauteng',
      status: 'duplicate',
      messages: ['Already on SportBridge (Parktown Girls, Gauteng).'],
    },
    {
      line: 5,
      name: 'Nowhere School',
      city: 'X',
      province: 'Narnia',
      status: 'error',
      messages: ['Province “Narnia” is not recognised.'],
    },
    {
      line: 6,
      name: 'Camps Bay High',
      city: 'Cape Town',
      province: 'Western Cape',
      status: 'ready',
      messages: [],
    },
  ],
  ...over,
});
const result: ImportResult = {
  batchId: 'b1',
  created: [
    { id: 'o1', name: 'Soweto High School', city: 'Soweto', province: 'Gauteng', claimCode: 'SB-7K4M-9XQ2' },
  ],
  skipped: [
    {
      line: 4,
      name: 'Parktown Girls',
      city: 'Johannesburg',
      province: 'Gauteng',
      status: 'duplicate',
      messages: ['Already on SportBridge.'],
    },
  ],
};

const r = () =>
  render(
    <MemoryRouter>
      <AdminImport />
    </MemoryRouter>,
  );
const pick = () => {
  const input = screen.getByLabelText('CSV file') as HTMLInputElement;
  const file = new File(['name,type,province\nSoweto High School,School,Gauteng'], 'schools.csv', {
    type: 'text/csv',
  });
  fireEvent.change(input, { target: { files: [file] } });
};
const source = (v = 'Gauteng schools list') =>
  fireEvent.change(screen.getByLabelText('Where did this list come from?'), { target: { value: v } });

beforeEach(() => {
  st.batches = [];
  downloaded.length = 0;
  vi.clearAllMocks();
  vi.mocked(is.previewImport).mockResolvedValue(preview());
  vi.mocked(is.runImport).mockResolvedValue(result);
});

describe('AdminImport', () => {
  it('offers the template and says what to put in it, including to avoid named people', () => {
    r();
    fireEvent.click(screen.getByRole('button', { name: 'Download template' }));
    expect(downloaded[0]!.name).toBe('sportbridge-import-template.csv');
    expect(downloaded[0]!.text.split(/\r?\n/)[0]).toBe(
      'name,type,province,city,sports,school_number,contact_email,contact_phone,website,description,source',
    );
    expect(screen.getByText(/main office/)).toBeTruthy();
    expect(screen.getByText(/500 rows/)).toBeTruthy();
    expect(screen.getByText(/Nothing is saved until you review the preview/)).toBeTruthy();
  });

  it('will not check a file until there is one and its source is given', () => {
    r();
    const check = screen.getByRole('button', { name: 'Check the file' }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    pick();
    expect(check.disabled).toBe(true);
    source();
    expect(check.disabled).toBe(false);
  });

  it('sends the file and its source to be checked, then shows every row with its reason', async () => {
    r();
    pick();
    source('Gauteng schools list');
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByText('3. Review before anything is saved')).toBeTruthy();
    expect(vi.mocked(is.previewImport).mock.calls[0]![0]).toMatchObject({
      source: 'Gauteng schools list',
      fileName: 'schools.csv',
    });
    expect(vi.mocked(is.previewImport).mock.calls[0]![0].csv).toContain('Soweto High School');
    expect(screen.getByText('2 ready')).toBeTruthy();
    expect(screen.getByText('1 duplicates')).toBeTruthy();
    expect(screen.getByText('1 errors')).toBeTruthy();
    expect(screen.getByText(/Province “Narnia” is not recognised/)).toBeTruthy();
    expect(screen.getByText(/Already on SportBridge/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import 3 schools' })).toBeTruthy();
    expect(is.runImport).not.toHaveBeenCalled(); // checking never saves anything
  });

  it('can show only the rows that need attention', async () => {
    r();
    pick();
    source();
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    await screen.findByText('3. Review before anything is saved');
    fireEvent.click(screen.getByLabelText('Show only rows that need attention'));
    expect(screen.queryByText('Camps Bay High')).toBeNull();
    expect(screen.getByText('Nowhere School')).toBeTruthy();
  });

  it('shows the reason when a file cannot be used at all', async () => {
    vi.mocked(is.previewImport).mockRejectedValueOnce(
      new ApiError(
        400,
        'IMPORT_INVALID',
        'The file needs a “name” column. Download the template to see the layout.',
      ),
    );
    r();
    pick();
    source();
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByText(/needs a “name” column/)).toBeTruthy();
    expect(screen.queryByText('3. Review before anything is saved')).toBeNull();
  });

  it('cannot import when nothing in the file is usable', async () => {
    vi.mocked(is.previewImport).mockResolvedValueOnce(
      preview({ importable: 0, counts: { ready: 0, warning: 0, duplicate: 2, error: 1 } }),
    );
    r();
    pick();
    source();
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    const button = (await screen.findByRole('button', { name: 'Import 0 schools' })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('asks before importing, then offers the claim codes with a clear warning that they are shown once', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    r();
    pick();
    source();
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3 schools' }));
    await waitFor(() => expect(is.runImport).toHaveBeenCalled());
    expect(await screen.findByText('Imported 1, skipped 1')).toBeTruthy();
    expect(screen.getByText(/available only now/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download claim codes' }));
    const codes = downloaded.find((d) => d.name === 'claim-codes.csv')!;
    expect(codes.text).toContain('school,city,province,claim_code');
    expect(codes.text).toContain('Soweto High School,Soweto,Gauteng,SB-7K4M-9XQ2');
    fireEvent.click(screen.getByRole('button', { name: 'Download skipped rows' }));
    expect(downloaded.find((d) => d.name === 'skipped-rows.csv')!.text).toContain('Parktown Girls');
  });

  it('does nothing if staff decline the confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    r();
    pick();
    source();
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3 schools' }));
    expect(is.runImport).not.toHaveBeenCalled();
  });

  it('undoes an import straight after it, with a warning about claimed schools', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    r();
    pick();
    source();
    fireEvent.click(screen.getByRole('button', { name: 'Check the file' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3 schools' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo this import' }));
    expect(confirm.mock.calls.at(-1)![0]).toMatch(/already claimed stay/);
    await waitFor(() => expect(is.undoImport).toHaveBeenCalledWith('b1'));
  });

  it('lists earlier imports and lets staff undo one that is not already undone', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    st.batches = [
      {
        id: 'b2',
        createdAt: '2026-11-12T10:00:00.000Z',
        createdBy: 'staff',
        sourceNote: 'DBE list',
        fileName: 'gauteng.csv',
        rowCount: 130,
        createdCount: 120,
        skippedCount: 10,
        status: 'active',
        orgIds: [],
      },
      {
        id: 'b3',
        createdAt: '2026-11-11T10:00:00.000Z',
        createdBy: 'staff',
        sourceNote: 'Old list',
        fileName: 'old.csv',
        rowCount: 5,
        createdCount: 5,
        skippedCount: 0,
        status: 'undone',
        orgIds: [],
        removedCount: 4,
        keptCount: 1,
      },
    ];
    r();
    const list = screen.getByRole('list', { name: 'Earlier imports' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]!.textContent).toContain('120 added, 10 skipped');
    expect(rows[1]!.textContent).toContain('undone (4 removed, 1 kept)');
    expect(within(rows[1]!).queryByRole('button', { name: 'Undo' })).toBeNull();
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(is.undoImport).toHaveBeenCalledWith('b2'));
  });
});
