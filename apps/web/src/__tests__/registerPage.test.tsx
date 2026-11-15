import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../pages/auth/RegisterPage';

const apiFetch = vi.fn<(path: string, init?: { json?: Record<string, unknown> }) => Promise<unknown>>(
  async () => ({ user: { uid: 'u1', role: 'organisation' } }),
);
vi.mock('../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../lib/apiClient')>('../lib/apiClient');
  return {
    ...actual,
    apiFetch: (path: string, init?: { json?: Record<string, unknown> }) => apiFetch(path, init),
  };
});
vi.mock('../lib/firebase', () => ({ requireAuth: () => ({ currentUser: { uid: 'u1', email: 'a@b.co' } }) }));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'u1' } })),
  sendEmailVerification: vi.fn(async () => {}),
  updateProfile: vi.fn(async () => {}),
}));
vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: { status: 'signedIn', user: { uid: 'u1', email: 'a@b.co', displayName: null } },
    refresh: vi.fn(),
  }),
}));

/** mode="finish" skips the email and password fields, so the profile part is what we exercise. */
const show = () =>
  render(
    <MemoryRouter>
      <RegisterPage mode="finish" />
    </MemoryRouter>,
  );
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const chooseRole = (role: string) =>
  fireEvent.change(screen.getByLabelText('How will you use SportBridge?'), { target: { value: role } });
const sent = () =>
  (apiFetch.mock.calls[0]?.[1] as { json?: Record<string, unknown> } | undefined)?.json ?? {};

beforeEach(() => {
  apiFetch.mockClear();
  apiFetch.mockResolvedValue({ user: { uid: 'u1', role: 'organisation' } });
});

describe('sign-up: organisations are not asked for a date of birth', () => {
  it('asks the account type first, then hides date of birth for an organisation', () => {
    show();
    // before a type is chosen, the date of birth is shown (most accounts are people)
    expect(screen.getByLabelText('Date of birth')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /18 or over/ })).toBeNull();
    chooseRole('organisation');
    expect(screen.queryByLabelText('Date of birth')).toBeNull();
    expect(screen.getByText(/I am 18 or over and authorised to act for this organisation/)).toBeTruthy();
  });

  it('still asks people for their date of birth', () => {
    show();
    for (const role of ['athlete', 'guardian', 'coach']) {
      chooseRole(role);
      expect(screen.getByLabelText('Date of birth')).toBeTruthy();
      expect(screen.queryByText(/I am 18 or over/)).toBeNull();
    }
  });

  it('sends no date of birth for an organisation, and does send the confirmation', async () => {
    show();
    type('First name', 'Thandi');
    type('Surname', 'Mokoena');
    type('Mobile number', '0821234567');
    chooseRole('organisation');
    type('Organisation name', 'Soweto FC');
    fireEvent.change(screen.getByLabelText('Organisation type'), { target: { value: 'club' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I am 18 or over/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the SportBridge terms/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue/ }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(sent()).toMatchObject({
      role: 'organisation',
      organisationName: 'Soweto FC',
      adultConfirmed: true,
    });
    expect(sent().dateOfBirth).toBeUndefined();
    expect(JSON.stringify(sent())).not.toContain('dateOfBirth');
  });

  it('will not submit an organisation until the confirmation is ticked', async () => {
    show();
    type('First name', 'Thandi');
    type('Surname', 'Mokoena');
    type('Mobile number', '0821234567');
    chooseRole('organisation');
    type('Organisation name', 'Soweto FC');
    fireEvent.change(screen.getByLabelText('Organisation type'), { target: { value: 'club' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the SportBridge terms/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save & Continue/ }));
    expect(await screen.findByText(/Confirm you are 18 or over/)).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
