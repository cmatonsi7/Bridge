import { z } from 'zod';

/**
 * Messaging (Phase 5a).
 *
 * There is no open inbox on SportBridge. A thread exists only because of a relationship that already
 * exists elsewhere — an accepted coach/athlete connection, or an application an organisation has
 * shortlisted or accepted — and it dies with that relationship. Nobody can start a conversation with
 * a stranger, and nobody can message a child without their parent reading every word of it.
 */

export const THREAD_KINDS = ['connection', 'application'] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

/**
 * open    — both sides can write.
 * closed  — the relationship behind it ended (connection ended, application withdrawn or declined).
 *           The history stays readable: closing a door is not the same as burning the letters.
 */
export const THREAD_STATUSES = ['open', 'closed'] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

/** Why a thread closed, so we can tell the person something truer than "closed". */
export const CLOSE_REASONS = ['connection_ended', 'application_finished', 'staff'] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const CLOSE_REASON_MESSAGES: Record<CloseReason, string> = {
  connection_ended: 'This connection has ended, so no new messages can be sent.',
  application_finished: 'This application is finished, so no new messages can be sent.',
  staff: 'SportBridge has closed this conversation.',
};

/**
 * A thread's id is derived from the thing that created it, never random: a connection thread is the
 * connection's own id, an application thread is the application's. That makes creating a thread twice
 * impossible, and makes closing one a direct lookup when the underlying relationship changes.
 */
export const threadIdFor = (kind: ThreadKind, sourceId: string) => `${kind}_${sourceId}`;

export interface ThreadParticipant {
  uid: string;
  displayName: string;
  role: string;
}

/**
 * messageThreads/{threadId}. Server-written only.
 *
 * `participantUids` is what the client queries on and what the rules check, so it must hold everyone
 * allowed to READ the thread — which includes a minor's guardians. `writerUids` is the smaller set
 * allowed to SEND. For an adult the two are the same; for a child, the guardians are in both (they can
 * read and they can write), and the child is in both too — that is the option-(a) decision: the child
 * speaks for themselves, with a parent reading over their shoulder and able to end it.
 */
export interface ThreadDoc {
  id: string;
  kind: ThreadKind;
  /** The connection or application this thread belongs to. */
  sourceId: string;
  status: ThreadStatus;
  closedReason: CloseReason | null;
  participants: ThreadParticipant[];
  participantUids: string[];
  writerUids: string[];
  /** Guardians reading on behalf of a minor. Empty for an adult-only thread. */
  guardianUids: string[];
  /** True when one side of this thread is an under-18 athlete. Drives the guardian notice in the UI. */
  hasMinor: boolean;
  /** What this conversation is about, shown as the thread's title. */
  subject: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** messageThreads/{threadId}/entries/{entryId}. Server-written only. */
export interface MessageDoc {
  id: string;
  threadId: string;
  senderUid: string;
  senderName: string;
  /**
   * Set when a guardian writes in a child's thread, so the other side can see plainly that they are
   * talking to the parent and not the child. Never hidden.
   */
  onBehalfOfUid: string | null;
  body: string;
  sentAt: string;
}

export const MESSAGE_MAX = 2000;

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write a message first')
    .max(MESSAGE_MAX, `Keep your message under ${MESSAGE_MAX} characters`),
});
export type SendMessageInput = z.input<typeof sendMessageSchema>;

/** Who may read: everyone listed. Who may write: writers only, and only while the thread is open. */
export const canRead = (t: Pick<ThreadDoc, 'participantUids'>, uid: string) => t.participantUids.includes(uid);
export const canWrite = (t: Pick<ThreadDoc, 'writerUids' | 'status'>, uid: string) =>
  t.status === 'open' && t.writerUids.includes(uid);

/** A one-line summary for the thread list. Long messages are cut, never reflowed. */
export const previewOf = (body: string, max = 120) =>
  body.length <= max ? body : `${body.slice(0, max - 1).trimEnd()}…`;

/** Threads with something new first, then the rest by when they were made. */
export function sortThreads<T extends Pick<ThreadDoc, 'lastMessageAt' | 'createdAt'>>(threads: T[]): T[] {
  return [...threads].sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
}

/**
 * Builds the read/write sets for a new thread from its two sides.
 *
 * The rule that matters: a minor's guardians are added to both sets. They are not silent observers —
 * they can step in — and the child keeps their own voice.
 */
export function membership(
  sides: { uid: string; displayName: string; role: string }[],
  guardianUids: string[],
  hasMinor: boolean,
): Pick<ThreadDoc, 'participants' | 'participantUids' | 'writerUids' | 'guardianUids' | 'hasMinor'> {
  const guardians = hasMinor ? [...new Set(guardianUids)] : [];
  const uids = sides.map((s) => s.uid);
  return {
    participants: sides.map((s) => ({ uid: s.uid, displayName: s.displayName, role: s.role })),
    participantUids: [...new Set([...uids, ...guardians])],
    writerUids: [...new Set([...uids, ...guardians])],
    guardianUids: guardians,
    hasMinor,
  };
}
