import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CoachVerificationDoc, CredentialDocRecord } from '@sportbridge/shared';

/**
 * The credentials page with document uploads SWITCHED ON.
 *
 * Uploads are off in production right now (Firebase Storage needs the paid Blaze plan, which the client
 * is not ready for). These tests keep the switched-on behaviour covered so that turning the flag back
 * on is a one-line change with proof behind it, rather than shipping an untested page months later.
 *
 * The flag and the copy derived from it are read at module load, so both are mocked here.
 */
vi.mock('@sportbridge/shared', async (orig) => {
  const actual = await orig<typeof import('@sportbridge/shared')>();
  return {
    ...actual,
    CREDENTIAL_UPLOADS_ENABLED: true,
    CREDENTIAL_STATUS_MESSAGES: {
      ...actual.CREDENTIAL_STATUS_MESSAGES,
      draft:
        'Add your qualifications and upload proof of each one, then send them to SportBridge for review.',
    },
    // canSubmit consults the real flag, so give the page the switched-on rule.
    canSubmit: (status: string, q: number, d: number) =>
      status !== 'submitted' && status !== 'verified' && q > 0 && d > 0,
  };
});

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

import CoachCredentialsPage from '../pages/app/coach/CoachCredentialsPage';
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

describe('Coach credentials page (document uploads switched on)', () => {
  it('asks for documents and says they are private, because they are identity documents', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getByText(/Upload proof of each qualification/)).toBeTruthy();
    expect(screen.getByText(/Only you and SportBridge staff can ever see these/)).toBeTruthy();
    expect(screen.getByText(/never shown on your profile or in the Talent Directory/)).toBeTruthy();
  });

  it('says what is missing before a coach can submit', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getByText(/Add at least one qualification on your profile first/)).toBeTruthy();
    st.view = view({ qualificationCount: 1 });
    render(<CoachCredentialsPage />);
    expect(screen.getAllByText('Upload at least one document proving a qualification.').length).toBe(1);
  });

  it('lists an uploaded document with its type and size, and sends it for review', async () => {
    st.view = view({ qualificationCount: 1, documents: [doc()], canSubmit: true });
    render(<CoachCredentialsPage />);
    expect(screen.getByText('level-2-certificate.pdf')).toBeTruthy();
    expect(screen.getByText(/PDF · 2 KB/)).toBeTruthy();

    const submit = screen.getByRole('button', { name: 'Send for review' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(svc.submitCredentials).toHaveBeenCalled());
  });

  it('removes a document', async () => {
    st.view = view({ qualificationCount: 1, documents: [doc()], canSubmit: true });
    render(<CoachCredentialsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(svc.removeCredential).toHaveBeenCalledWith('doc1'));
  });

  it('freezes everything while staff are reading it', () => {
    st.view = view({
      verification: verification({ status: 'submitted', submittedAt: '2026-11-12T00:00:00.000Z' }),
      qualificationCount: 1,
      documents: [doc()],
      canSubmit: false,
    });
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Awaiting review')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Add a document')).toBeNull();
    expect((screen.getByRole('button', { name: 'Send for review' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows a rejected coach the reason, and lets them try again', () => {
    st.view = view({
      verification: verification({
        status: 'rejected',
        decisionNote: 'The certificate was cut off at the bottom.',
        decidedAt: '2026-11-13T00:00:00.000Z',
      }),
      qualificationCount: 1,
      documents: [doc()],
      canSubmit: true,
    });
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Needs attention')).toBeTruthy();
    expect(screen.getByText('The certificate was cut off at the bottom.')).toBeTruthy();
    expect(screen.getByLabelText('Add a document')).toBeTruthy();
  });

  it('tells a verified coach they are done', () => {
    st.view = view({
      verification: verification({ status: 'verified', decidedAt: '2026-11-14T00:00:00.000Z' }),
      qualificationCount: 1,
      documents: [doc()],
      canSubmit: false,
    });
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('You are verified. Nothing more to do.')).toBeTruthy();
  });
});
