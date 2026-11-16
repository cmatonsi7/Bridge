import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MessagesPage from '../pages/app/messages/MessagesPage';
import { membership as threadMembership, type MessageDoc, type ThreadDoc } from '@sportbridge/shared';

const st = {
  threads: [] as ThreadDoc[],
  threadState: null as unknown,
  listState: null as unknown,
};

vi.mock('../features/account/useSignedInUser', () => ({
  useSignedInUser: () => ({ uid: 'me', email: 'me@x.co', user: { role: 'athlete' } }),
}));
vi.mock('../features/messages/messagesService', async (orig) => ({
  ...(await orig<typeof import('../features/messages/messagesService')>()),
  useThreads: () => ({
    state: st.listState ?? { status: 'ready', data: st.threads },
    reload: vi.fn(),
  }),
  useThread: (id: string | null) => ({
    state: id ? (st.threadState ?? { status: 'ready', data: null }) : { status: 'ready', data: null },
    reload: vi.fn(async () => {}),
  }),
  sendMessage: vi.fn(async () => ({})),
}));

import * as svc from '../features/messages/messagesService';

const thread = (over: Partial<ThreadDoc> = {}): ThreadDoc => ({
  id: 'connection_coach_me',
  kind: 'connection',
  sourceId: 'coach_me',
  status: 'open',
  closedReason: null,
  subject: 'Coach Carter and Me',
  ...threadMembership(
    [
      { uid: 'coach', displayName: 'Coach Carter', role: 'coach' },
      { uid: 'me', displayName: 'Me', role: 'athlete' },
    ],
    [],
    false,
  ),
  lastMessageAt: '2026-11-10T08:00:00.000Z',
  lastMessagePreview: 'See you Thursday',
  lastMessageBy: 'coach',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-10T08:00:00.000Z',
  ...over,
});

const message = (over: Partial<MessageDoc> = {}): MessageDoc => ({
  id: 'm1',
  threadId: 'connection_coach_me',
  senderUid: 'coach',
  senderName: 'Coach Carter',
  onBehalfOfUid: null,
  body: 'See you Thursday',
  sentAt: '2026-11-10T08:00:00.000Z',
  ...over,
});

beforeEach(() => {
  st.threads = [thread()];
  st.threadState = null;
  st.listState = null;
  vi.clearAllMocks();
});

describe('Messages page', () => {
  it('tells someone with no conversations how one actually starts', () => {
    st.threads = [];
    render(<MessagesPage />);
    expect(screen.getByText('No conversations yet.')).toBeTruthy();
    expect(screen.getByText(/connection is accepted, or when an organisation shortlists/)).toBeTruthy();
  });

  it('lists a conversation by the other person, with its subject and last message', () => {
    render(<MessagesPage />);
    expect(screen.getByText('Coach Carter')).toBeTruthy();
    expect(screen.getByText('Coach Carter and Me')).toBeTruthy();
    expect(screen.getByText('See you Thursday')).toBeTruthy();
  });

  it('asks you to pick a conversation before showing one', () => {
    render(<MessagesPage />);
    expect(screen.getByText('Choose a conversation to read it.')).toBeTruthy();
  });

  it('opens a conversation and sends a message', async () => {
    st.threadState = { status: 'ready', data: { thread: thread(), messages: [message()] } };
    render(<MessagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Coach Carter/ }));

    const box = screen.getByLabelText('Your message') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'Thanks coach' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(svc.sendMessage).toHaveBeenCalledWith('connection_coach_me', 'Thanks coach'),
    );
  });

  it('will not send an empty message', () => {
    st.threadState = { status: 'ready', data: { thread: thread(), messages: [] } };
    render(<MessagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Coach Carter/ }));
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('warns everyone, plainly, when a child’s parent is in the conversation', () => {
    const t = thread({
      ...threadMembership(
        [
          { uid: 'coach', displayName: 'Coach Carter', role: 'coach' },
          { uid: 'me', displayName: 'Me', role: 'athlete' },
        ],
        ['mum'],
        true,
      ),
    });
    st.threads = [t];
    st.threadState = { status: 'ready', data: { thread: t, messages: [] } };
    render(<MessagesPage />);
    expect(screen.getByText('Parent included')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Coach Carter/ }));
    expect(screen.getByText(/parent or guardian is part of this conversation/)).toBeTruthy();
  });

  it('names a parent who writes for their child, rather than hiding it', () => {
    const t = thread({
      ...threadMembership(
        [
          { uid: 'coach', displayName: 'Coach Carter', role: 'coach' },
          { uid: 'kid', displayName: 'Young Athlete', role: 'athlete' },
        ],
        ['mum'],
        true,
      ),
    });
    st.threads = [t];
    st.threadState = {
      status: 'ready',
      data: {
        thread: t,
        messages: [message({ senderUid: 'mum', senderName: 'Mum Parent', onBehalfOfUid: 'kid' })],
      },
    };
    render(<MessagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Coach Carter/ }));
    expect(screen.getByText(/Mum Parent \(parent of Young Athlete\)/)).toBeTruthy();
  });

  it('keeps a closed conversation readable but takes the box away', () => {
    const t = thread({ status: 'closed', closedReason: 'connection_ended' });
    st.threads = [t];
    st.threadState = { status: 'ready', data: { thread: t, messages: [message()] } };
    render(<MessagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Coach Carter/ }));
    expect(screen.getByText(/This connection has ended/)).toBeTruthy();
    expect(screen.getByText(/You can still read what was said/)).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('says so when someone may read a conversation but not reply', () => {
    const t = thread({ writerUids: ['coach'] });
    st.threads = [t];
    st.threadState = { status: 'ready', data: { thread: t, messages: [message()] } };
    render(<MessagesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Coach Carter/ }));
    expect(screen.getByText('You can read this conversation but not reply to it.')).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('shows an alert when the list cannot be loaded', () => {
    st.listState = { status: 'error', message: 'We couldn’t load your messages.' };
    render(<MessagesPage />);
    expect(screen.getByRole('alert').textContent).toContain('couldn’t load your messages');
  });
});
