import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../lib/apiClient';
import * as as from '../features/admin/adminService';
import type { QueueItem } from '../features/admin/adminService';
import AdminVerification from '../pages/app/admin/AdminVerification';

const org = (over: Partial<QueueItem>): QueueItem => ({
  id: 'o1',
  name: 'Soweto High School',
  type: 'school',
  ownerUid: 'rep',
  verified: false,
  claimStatus: 'claimed',
  source: 'staff_import',
  claimedAt: '2026-11-10T09:00:00.000Z',
  schoolNumber: '700123456',
  city: 'Soweto',
  province: 'Gauteng',
  contactEmail: 'office@sowetohigh.edu.za',
  contactPhone: '0111234567',
  website: 'https://sowetohigh.edu.za',
  listingCount: 3,
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
  ...over,
});
const st = { awaiting: [org({})], verified: [] as QueueItem[] };

vi.mock('../features/admin/adminService', () => ({
  useVerificationQueue: () => ({ status: 'ready', data: { awaiting: st.awaiting, verified: st.verified } }),
  verifyOrganisation: vi.fn(async () => ({ ok: true, name: 'Soweto High School' })),
  removeVerification: vi.fn(async () => ({ ok: true, name: 'Soweto High School' })),
}));

const r = () =>
  render(
    <MemoryRouter>
      <AdminVerification />
    </MemoryRouter>,
  );
beforeEach(() => {
  st.awaiting = [org({})];
  st.verified = [];
  vi.clearAllMocks();
});

describe('AdminVerification', () => {
  it('explains what verified promises, and shows what staff need to decide', () => {
    r();
    expect(screen.getByText('What “verified” promises')).toBeTruthy();
    expect(screen.getByText('Awaiting verification (1)')).toBeTruthy();
    expect(screen.getByText(/School no\. 700123456/)).toBeTruthy();
    expect(screen.getByText(/office@sowetohigh.edu.za · 0111234567/)).toBeTruthy();
    expect(screen.getByText(/Added by SportBridge, claimed/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // listings
  });

  it('never verifies on a single click: it asks for confirmation first, and sends the note', async () => {
    r();
    fireEvent.click(screen.getByRole('button', { name: 'Verify…' }));
    expect(as.verifyOrganisation).not.toHaveBeenCalled();
    expect(screen.getByText(/Families rely on this badge/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Internal note/), { target: { value: 'Phoned the school' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm verification' }));
    await waitFor(() => expect(as.verifyOrganisation).toHaveBeenCalledWith('o1', 'Phoned the school'));
  });

  it('can be cancelled without anything being sent', () => {
    r();
    fireEvent.click(screen.getByRole('button', { name: 'Verify…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Verify…' })).toBeTruthy();
    expect(as.verifyOrganisation).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when it refuses', async () => {
    vi.mocked(as.verifyOrganisation).mockRejectedValueOnce(
      new ApiError(409, 'ALREADY_VERIFIED', 'This organisation is already verified'),
    );
    r();
    fireEvent.click(screen.getByRole('button', { name: 'Verify…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm verification' }));
    expect(await screen.findByText('This organisation is already verified')).toBeTruthy();
  });

  it('removing verification asks for confirmation and records why', async () => {
    st.awaiting = [];
    st.verified = [org({ verified: true, verifiedAt: '2026-11-11T09:00:00.000Z' })];
    r();
    expect(screen.getByText('Verified (1)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove verification…' }));
    expect(screen.getByText(/removes the Verified badge/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Internal note/), {
      target: { value: 'Contact details were wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() =>
      expect(as.removeVerification).toHaveBeenCalledWith('o1', 'Contact details were wrong'),
    );
  });

  it('has honest empty states', () => {
    st.awaiting = [];
    r();
    expect(screen.getByText(/Nothing is waiting/)).toBeTruthy();
    expect(screen.getByText('No organisation is verified yet.')).toBeTruthy();
  });

  it('says how an organisation that registered itself joined', () => {
    st.awaiting = [org({ source: 'self_registered', name: 'Test FC' })];
    r();
    const card = screen.getByText('Test FC').closest('.sb-card') as HTMLElement;
    expect(within(card).getByText(/Registered itself/)).toBeTruthy();
  });
});
