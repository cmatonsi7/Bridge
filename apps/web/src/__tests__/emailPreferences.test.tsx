import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailPreferencesForm } from '../features/account/EmailPreferencesForm';

const st = {
  get: null as unknown,
  putError: false as boolean | string,
  puts: [] as unknown[],
};

vi.mock('../lib/apiClient', async (orig) => {
  const actual = await orig<typeof import('../lib/apiClient')>();
  return {
    ...actual,
    apiFetch: vi.fn(async (path: string, opts?: { method?: string; json?: unknown }) => {
      if (opts?.method === 'PUT') {
        st.puts.push(opts.json);
        if (st.putError) throw new actual.ApiError(400, 'BAD', 'We couldn’t save that. Try again.');
        return { preferences: opts.json };
      }
      if (st.get instanceof Error) throw st.get;
      return { preferences: st.get ?? { activity: true, messages: true } };
    }),
  };
});

beforeEach(() => {
  st.get = null;
  st.putError = false;
  st.puts = [];
  vi.clearAllMocks();
});

describe('Email notification settings', () => {
  it('shows both switches on, since a new account should be reachable', async () => {
    render(<EmailPreferencesForm />);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    for (const box of screen.getAllByRole('checkbox')) {
      expect((box as HTMLInputElement).checked).toBe(true);
    }
  });

  it('is clear that this only governs email, not the app', async () => {
    render(<EmailPreferencesForm />);
    await waitFor(() => screen.getByText(/always show these in the app/));
    expect(screen.getByText(/also reaches your inbox/)).toBeTruthy();
  });

  it('says plainly which emails cannot be switched off, rather than hiding them', async () => {
    render(<EmailPreferencesForm />);
    await waitFor(() => screen.getByText(/sent whatever you choose/));
    expect(screen.getByText(/coach asking to connect with your child/)).toBeTruthy();
  });

  it('saves the moment a switch is changed', async () => {
    render(<EmailPreferencesForm />);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    await waitFor(() => expect(st.puts).toEqual([{ activity: true, messages: false }]));
    expect(screen.getByRole('status').textContent).toContain('Saved');
  });

  it('reflects what was already saved', async () => {
    st.get = { activity: false, messages: true };
    render(<EmailPreferencesForm />);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes[0]!.checked).toBe(false);
    expect(boxes[1]!.checked).toBe(true);
  });

  it('puts the switch back if the save fails, rather than claiming it saved', async () => {
    st.putError = true;
    render(<EmailPreferencesForm />);
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    await waitFor(() => screen.getByRole('alert'));
    expect((screen.getAllByRole('checkbox')[1] as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows an alert when the settings cannot be loaded', async () => {
    st.get = new Error('offline');
    render(<EmailPreferencesForm />);
    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toContain('couldn’t load');
  });
});
