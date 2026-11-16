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

describe('Coach credentials page', () => {
  it('tells an unverified coach plainly that they cannot contact athletes yet', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Not submitted')).toBeTruthy();
    expect(screen.getByText(/you cannot send connection requests to athletes/)).toBeTruthy();
  });

  it('says the documents are private, because they are identity documents', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getByText(/Only you and SportBridge staff can ever see these/)).toBeTruthy();
    expect(screen.getByText(/never shown on your profile or in the Talent Directory/)).toBeTruthy();
  });

  it('will not let a coach submit with nothing to review, and says what is missing', () => {
    render(<CoachCredentialsPage />);
    expect(screen.getByText(/Add at least one qualification on your profile first/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send for review' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('asks for a document once a qualification exists', () => {
    st.view = view({ qualificationCount: 1 });
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Upload at least one document proving a qualification.')).toBeTruthy();
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
    // No way to add another document while it is under review.
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
    expect((screen.getByRole('button', { name: 'Send for review' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('tells a verified coach they are done, and that they can now connect', () => {
    st.view = view({
      verification: verification({ status: 'verified', decidedAt: '2026-11-14T00:00:00.000Z' }),
      qualificationCount: 1,
      documents: [doc()],
      canSubmit: false,
    });
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText(/you can send connection requests/)).toBeTruthy();
    expect(screen.getByText('You are verified. Nothing more to do.')).toBeTruthy();
  });

  it('is not shown to accounts that are not coaches', () => {
    st.role = 'athlete';
    st.view = null;
    render(<CoachCredentialsPage />);
    expect(screen.getByText('Only coach accounts have credentials to verify.')).toBeTruthy();
  });
});
