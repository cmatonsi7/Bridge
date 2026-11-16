import { useEffect, useRef, useState } from 'react';
import {
  CLOSE_REASON_MESSAGES,
  MESSAGE_MAX,
  type MessageDoc,
  type ThreadDoc,
} from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { BootScreen } from '../../../app/guards';
import { ApiError } from '../../../lib/apiClient';
import {
  otherSide,
  sendMessage,
  useThread,
  useThreads,
  when,
} from '../../../features/messages/messagesService';

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Try again.';

/**
 * Messages (Phase 5a). There is no open inbox: every conversation here exists because of a connection
 * or an application. A thread involving an under-18 athlete includes their parent, and the page says so
 * plainly to everyone in it — nobody should be able to message a child without knowing who is reading.
 */
export default function MessagesPage() {
  const me = useSignedInUser();
  const { state, reload } = useThreads(me?.uid);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!me) return <BootScreen label="Loading…" />;
  return (
    <section className="sb-page active" id="sb-page-messages">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">MESSAGES</div>
          <h1>Messages</h1>
          <p>Conversations with the coaches, clubs and programmes you are already connected to.</p>
        </div>
      </div>

      {state.status === 'loading' && <BootScreen label="Loading your messages…" />}
      {state.status === 'error' && (
        <div className="sb-card sb-empty" role="alert">
          {state.message}
        </div>
      )}
      {state.status === 'ready' && state.data && state.data.length === 0 && (
        <div className="sb-card sb-empty">
          <p style={{ margin: 0 }}>No conversations yet.</p>
          <p className="sb-meta" style={{ marginTop: 6 }}>
            A conversation opens when a coach connection is accepted, or when an organisation shortlists
            your application.
          </p>
        </div>
      )}
      {state.status === 'ready' && state.data && state.data.length > 0 && (
        <div className="sb-messages-layout">
          <ThreadList
            threads={state.data}
            uid={me.uid}
            openId={openId}
            onOpen={(id) => setOpenId(id)}
          />
          <Conversation threadId={openId} uid={me.uid} onSent={reload} />
        </div>
      )}
    </section>
  );
}

function ThreadList({
  threads,
  uid,
  openId,
  onOpen,
}: {
  threads: ThreadDoc[];
  uid: string;
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="sb-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {threads.map((t) => {
          const names = otherSide(t, uid)
            .map((p) => p.displayName)
            .join(', ');
          return (
            <li key={t.id}>
              <button
                type="button"
                className={`sb-thread-row${openId === t.id ? ' is-open' : ''}`}
                onClick={() => onOpen(t.id)}
                aria-current={openId === t.id}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{names}</strong>
                  <span className="sb-meta">{when(t.lastMessageAt)}</span>
                </div>
                <div className="sb-meta">{t.subject}</div>
                <div className="sb-thread-preview">
                  {t.lastMessagePreview ?? 'No messages yet — say hello.'}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {t.status === 'closed' && <span className="sb-status closed">Closed</span>}
                  {t.hasMinor && <span className="sb-status review">Parent included</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Conversation({
  threadId,
  uid,
  onSent,
}: {
  threadId: string | null;
  uid: string;
  onSent: () => void;
}) {
  const { state, reload } = useThread(threadId);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = state.status === 'ready' && state.data ? state.data.messages : [];
  useEffect(() => {
    // Guarded: scrollIntoView does not exist in every environment (jsdom has no layout), and failing
    // to scroll must never take the conversation down with it.
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  if (!threadId) {
    return (
      <div className="sb-card sb-empty">
        <p style={{ margin: 0 }}>Choose a conversation to read it.</p>
      </div>
    );
  }
  if (state.status === 'loading') return <BootScreen label="Loading this conversation…" />;
  if (state.status === 'error') {
    return (
      <div className="sb-card sb-empty" role="alert">
        {state.message}
      </div>
    );
  }
  if (!state.data) return null;
  const { thread } = state.data;
  const canWrite = thread.status === 'open' && thread.writerUids.includes(uid);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !threadId) return;
    setBusy(true);
    setError('');
    try {
      await sendMessage(threadId, text);
      setBody('');
      await reload();
      onSent();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
          {otherSide(thread, uid)
            .map((p) => p.displayName)
            .join(', ')}
        </h2>
        <p className="sb-meta" style={{ margin: '2px 0 0' }}>{thread.subject}</p>
      </div>

      {thread.hasMinor && (
        <div className="sb-field-hint">
          This athlete is under 18, so their parent or guardian is part of this conversation and can read
          every message.
        </div>
      )}

      <div className="sb-thread-messages">
        {messages.length === 0 && <p className="sb-meta">No messages yet.</p>}
        {messages.map((m) => (
          <Message key={m.id} message={m} mine={m.senderUid === uid} thread={thread} />
        ))}
        <div ref={endRef} />
      </div>

      {thread.status === 'closed' ? (
        <div className="sb-field-hint" role="status">
          {CLOSE_REASON_MESSAGES[thread.closedReason ?? 'staff']} You can still read what was said.
        </div>
      ) : canWrite ? (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="sb-message-body">
            Your message
          </label>
          <textarea
            id="sb-message-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={3}
            placeholder="Write a message…"
          />
          {error && (
            <p className="sb-form-status err" role="alert">
              {error}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="sb-btn primary" type="submit" disabled={busy || body.trim() === ''}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      ) : (
        <div className="sb-field-hint" role="status">
          You can read this conversation but not reply to it.
        </div>
      )}
    </div>
  );
}

function Message({ message, mine, thread }: { message: MessageDoc; mine: boolean; thread: ThreadDoc }) {
  // A parent writing for their child is named as exactly that, never hidden behind the child's name.
  const onBehalf = message.onBehalfOfUid
    ? thread.participants.find((p) => p.uid === message.onBehalfOfUid)
    : null;
  return (
    <div className={`sb-message${mine ? ' mine' : ''}`}>
      <div className="sb-meta">
        {message.senderName}
        {onBehalf ? ` (parent of ${onBehalf.displayName})` : ''} · {when(message.sentAt)}
      </div>
      <p style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{message.body}</p>
    </div>
  );
}
