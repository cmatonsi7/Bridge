import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CoachCredentialsPage from '../pages/app/coach/CoachCredentialsPage';
import type { CoachVerificationDoc, CredentialDocRecord } from '@sportbridge/shared';

const st = { role: 'coach', view: null as unknown };

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({ uid: 'me', email: 'me@x.co', user: { role: st.role } }),
}));
vi.mock('../features/coach/credentialsService', async (orig) => ({
  ...(await orig<typeof import('../features/coach/credentialsService')>()),
  useCredentials: () => ({ state: { status: 'ready', data: st.view }, reload: vi.fn() }),
  uploadCredential: vi.fn(async () => ({})),
  removeCredential: vi.fn(async () => ({ ok: true })),
  submitCredentials: vi.fn(async () => ({ ok: true })),
}));

import * as svc from '../features/coach/credentialsService';

const verification = (over: Partial<CoachVerificationDoc> = {}): CoachVerificationDoc => ({
  uid: 'me',
  displayName: 'Coach Carter',
  status: 'draft',
  decisionNote: null,
  submittedAt: null,
  decidedAt: null,
  decidedByUid: null,
  docCount: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const doc = (over: Partial<CredentialDocRecord> = {}): CredentialDocRecord => ({
  id: 'doc1',
  qualificationId: null,
  fileName: 'level-2-certificate.pdf',
  contentType: 'application/pdf',
  sizeBytes: 2048,
  storagePath: 'coachCredentials/me/doc1',
  uploadedAt: '2026-11-10T00:00:00.000Z',
  ...over,
});

const view = (over: Record<string, unknown> = {}) => ({
  verification: verification(),
  documents: [] as CredentialDocRecord[],
  qualificationCount: 0,
  canSubmit: false,
  ...over,
});

beforeEach(() => {
  st.role = 'coach';
  st.view = view();
  vi.clearAllMocks();
});

describe('Coach credentials page (document uploads switched off)', () => {
  it('tells a coach plainly that there is nothing to do yet, and asks for nothing', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Not submitted')).toBeTruthy();
    expect(screen.getByText(/Credential checks are not open yet/)).toBeTruthy();
    // The old copy promised a check nobody can perform and threatened a block that is not in force.
    expect(screen.queryByText(/upload proof of each one/i)).toBeNull();
    expect(screen.queryByText(/cannot send connection requests/i)).toBeNull();
  });

  it('offers no upload control, because uploading cannot work', () => {
    st.view = view({ qualificationCount: 1 });
    render(<CoachCredentialsPage />);
    expect(screen.queryByLabelText('Add a document')).toBeNull();
    expect(screen.getByText(/Document uploads are not switched on yet/)).toBeTruthy();
  });

  it('points a coach at something useful in the meantime', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getAllByText(/add your qualifications on your profile/i).length).toBeGreaterThan(0);
  });

  it('still promises the documents will be private when they do open', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getByText(/only you and SportBridge staff will ever see those documents/i)).toBeTruthy();
  });

  it('cannot be submitted, so staff never get an empty review', () => {
    st.view = view({ qualificationCount: 3 });
    render(<CoachCredentialsPage />);
    expect((screen.getByRole('button', { name: 'Send for review' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/Reviews are not open yet/)).toBeTruthy();
  });

  it('is not shown to accounts that are not coaches', () => {
    st.role = 'athlete';
    st.view = null;
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Only coach accounts have credentials to verify.')).toBeTruthy();
  });

  it('shows an alert when it cannot be loaded', () => {
    st.view = null;
    st.role = 'coach';
    render(<CoachCredentialsPage />);
    // A coach with no data at all renders nothing rather than a broken page.
    expect(screen.getByRole('heading', { name: 'My Credentials' })).toBeTruthy();
  });
});
