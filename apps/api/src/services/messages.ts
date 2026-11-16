import {
  canWrite,
  membership,
  previewOf,
  sendMessageSchema,
  threadIdFor,
  type ApplicationDoc,
  type ConnectionDoc,
  type MessageDoc,
  type NotificationDoc,
  type ThreadDoc,
  type ThreadKind,
  type CloseReason,
} from '@sportbridge/shared';
import { HttpError } from '../middleware/errors.js';

export type Outbox = { uid: string; notification: NotificationDoc }[];
type Audit = Record<string, unknown>;

export interface MessagePerson {
  uid: string;
  displayName: string;
  role: string;
  isMinor: boolean;
  guardianUids: string[];
}

export interface MessagesRepoPort {
  newMessageId(): string;
  getPerson(uid: string): Promise<MessagePerson | null>;
  getThread(id: string): Promise<ThreadDoc | null>;
  threadsFor(uid: string): Promise<ThreadDoc[]>;
  entries(threadId: string, limit: number): Promise<MessageDoc[]>;
  /** Creates the thread only if it is not already there. Never throws on a repeat. */
  ensureThread(id: string, build: () => ThreadDoc): Promise<ThreadDoc>;
  /** Appends the message and updates the thread's summary fields in one write. */
  appendMessage(
    threadId: string,
    message: MessageDoc,
    threadChanges: Partial<ThreadDoc>,
    outbox: Outbox,
    audit: Audit,
  ): Promise<void>;
  updateThread(id: string, changes: Partial<ThreadDoc>, audit: Audit): Promise<void>;
  getConnection(id: string): Promise<ConnectionDoc | null>;
  getApplication(id: string): Promise<ApplicationDoc | null>;
  /** Athletes this person is a verified parent or guardian of. Empty for everyone else. */
  childrenOf(uid: string): Promise<string[]>;
  /** Ids of accepted connections involving any of these people. */
  acceptedConnectionIds(uids: string[]): Promise<string[]>;
  /** Ids of shortlisted or accepted applications involving any of these people. */
  liveApplicationIds(uids: string[]): Promise<string[]>;
}

export interface Caller {
  uid: string;
  role?: string;
  admin?: boolean;
  emailVerified: boolean;
}

const note = (title: string, body: string, at: string): NotificationDoc => ({
  type: 'message.received',
  title,
  body,
  link: '/app/messages',
  read: false,
  createdAt: at,
});

/**
 * Builds a thread for an accepted coach/athlete connection.
 * Called when the connection is accepted, and again (harmlessly) the first time anyone opens Messages,
 * so a connection accepted before this feature shipped still gets its thread.
 */
export async function threadForConnection(
  repo: MessagesRepoPort,
  connectionId: string,
  now = new Date(),
): Promise<ThreadDoc | null> {
  const conn = await repo.getConnection(connectionId);
  if (!conn || conn.status !== 'accepted') return null;
  const [coach, athlete] = await Promise.all([repo.getPerson(conn.coachUid), repo.getPerson(conn.athleteUid)]);
  if (!coach || !athlete) return null;
  const ts = now.toISOString();
  const id = threadIdFor('connection', connectionId);
  return repo.ensureThread(id, () => ({
    id,
    kind: 'connection' as ThreadKind,
    sourceId: connectionId,
    status: 'open',
    closedReason: null,
    subject: `${conn.coachName} and ${conn.athleteName}`,
    ...membership(
      [
        { uid: coach.uid, displayName: coach.displayName, role: 'coach' },
        { uid: athlete.uid, displayName: athlete.displayName, role: 'athlete' },
      ],
      athlete.guardianUids,
      athlete.isMinor,
    ),
    lastMessageAt: null,
    lastMessagePreview: null,
    lastMessageBy: null,
    createdAt: ts,
    updatedAt: ts,
  }));
}

/** Builds a thread for an application an organisation has shortlisted or accepted. */
export async function threadForApplication(
  repo: MessagesRepoPort,
  applicationId: string,
  now = new Date(),
): Promise<ThreadDoc | null> {
  const app = await repo.getApplication(applicationId);
  // An organisation may not message everyone who applies — only someone they have taken an interest in.
  if (!app || (app.status !== 'shortlisted' && app.status !== 'accepted')) return null;
  const [applicant, org] = await Promise.all([
    repo.getPerson(app.applicantUid),
    repo.getPerson(app.ownerUid),
  ]);
  if (!applicant || !org) return null;
  const ts = now.toISOString();
  const id = threadIdFor('application', applicationId);
  return repo.ensureThread(id, () => ({
    id,
    kind: 'application' as ThreadKind,
    sourceId: applicationId,
    status: 'open',
    closedReason: null,
    subject: app.listingTitle,
    ...membership(
      [
        { uid: org.uid, displayName: org.displayName, role: org.role },
        { uid: applicant.uid, displayName: applicant.displayName, role: applicant.role },
      ],
      applicant.guardianUids,
      applicant.isMinor,
    ),
    lastMessageAt: null,
    lastMessagePreview: null,
    lastMessageBy: null,
    createdAt: ts,
    updatedAt: ts,
  }));
}

/**
 * Closes the thread behind a relationship that has ended. Messages stay readable; nothing new can be sent.
 * Missing threads are not an error: a connection may have ended before anyone wrote a word.
 */
export async function closeThreadFor(
  repo: MessagesRepoPort,
  kind: ThreadKind,
  sourceId: string,
  reason: CloseReason,
  now = new Date(),
) {
  const id = threadIdFor(kind, sourceId);
  const thread = await repo.getThread(id);
  if (!thread || thread.status === 'closed') return;
  await repo.updateThread(
    id,
    { status: 'closed', closedReason: reason, updatedAt: now.toISOString() },
    { type: 'thread.closed', threadId: id, reason, at: now.toISOString() },
  );
}

/**
 * Creates any thread this person should have but does not.
 *
 * Threads are normally opened the moment a connection is accepted or an application is shortlisted.
 * That leaves out every relationship formed *before* messaging existed, and anything that slipped
 * through a failed write — those people would otherwise see an empty Messages page forever, with the
 * conversation they are entitled to unreachable. So the list repairs itself on read.
 *
 * A parent is included through their children, because a guardian's uid is not on the connection or
 * the application itself — and a parent who cannot reach their child's conversation is exactly the
 * person this design most needs to reach it.
 */
async function backfillThreads(repo: MessagesRepoPort, c: Caller, have: Set<string>, now: Date) {
  const subjects = [c.uid, ...(await repo.childrenOf(c.uid))];
  const [connectionIds, applicationIds] = await Promise.all([
    repo.acceptedConnectionIds(subjects),
    repo.liveApplicationIds(subjects),
  ]);
  const missing: { kind: ThreadKind; id: string }[] = [
    ...connectionIds.map((id) => ({ kind: 'connection' as ThreadKind, id })),
    ...applicationIds.map((id) => ({ kind: 'application' as ThreadKind, id })),
  ].filter((m) => !have.has(threadIdFor(m.kind, m.id)));
  if (missing.length === 0) return false;

  // One bad relationship must not stop the others appearing, so each is attempted on its own.
  await Promise.all(
    missing.map((m) =>
      (m.kind === 'connection'
        ? threadForConnection(repo, m.id, now)
        : threadForApplication(repo, m.id, now)
      ).catch(() => undefined),
    ),
  );
  return true;
}

/** Every thread this person can see, newest activity first. */
export async function listThreads(repo: MessagesRepoPort, c: Caller, now = new Date()) {
  let threads = await repo.threadsFor(c.uid);
  const created = await backfillThreads(repo, c, new Set(threads.map((t) => t.id)), now).catch(
    // A backfill that fails must never take the page down: the person still sees what they already have.
    () => false,
  );
  if (created) threads = await repo.threadsFor(c.uid);
  return threads.sort((a, b) =>
    (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
  );
}

function readable(thread: ThreadDoc | null, c: Caller): ThreadDoc {
  if (!thread) throw new HttpError(404, 'THREAD_NOT_FOUND', 'This conversation could not be found');
  if (!thread.participantUids.includes(c.uid) && !c.admin) {
    // Deliberately the same answer as a missing thread: a stranger learns nothing from probing ids.
    throw new HttpError(404, 'THREAD_NOT_FOUND', 'This conversation could not be found');
  }
  return thread;
}

export async function readThread(repo: MessagesRepoPort, c: Caller, id: string, limit = 200) {
  const thread = readable(await repo.getThread(id), c);
  const messages = await repo.entries(id, limit);
  return { thread, messages };
}

export async function sendMessage(
  repo: MessagesRepoPort,
  c: Caller,
  threadId: string,
  raw: unknown,
  now = new Date(),
) {
  const { body } = sendMessageSchema.parse(raw ?? {});
  if (!c.emailVerified) throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address first');
  const thread = readable(await repo.getThread(threadId), c);
  if (thread.status === 'closed') {
    throw new HttpError(409, 'THREAD_CLOSED', 'This conversation is closed, so no new messages can be sent');
  }
  // Staff can read a thread but never write into one: a conversation between two people stays theirs.
  if (!canWrite(thread, c.uid)) {
    throw new HttpError(403, 'NOT_ALLOWED', 'You cannot send messages in this conversation');
  }
  const sender = await repo.getPerson(c.uid);
  if (!sender) throw new HttpError(404, 'NO_PROFILE', 'Finish setting up your account first');

  const ts = now.toISOString();
  const id = repo.newMessageId();
  // A guardian writing in a child's thread is named as themselves, with the child named too, so the
  // other side always knows who is actually talking.
  const onBehalfOf = thread.guardianUids.includes(c.uid)
    ? (thread.participants.find((p) => p.role === 'athlete')?.uid ?? null)
    : null;
  const message: MessageDoc = {
    id,
    threadId,
    senderUid: c.uid,
    senderName: sender.displayName,
    onBehalfOfUid: onBehalfOf,
    body,
    sentAt: ts,
  };
  const preview = previewOf(body);
  const others = thread.participantUids.filter((u) => u !== c.uid);
  const outbox: Outbox = others.map((uid) => ({
    uid,
    notification: note(`New message from ${sender.displayName}`, preview, ts),
  }));

  await repo.appendMessage(
    threadId,
    message,
    { lastMessageAt: ts, lastMessagePreview: preview, lastMessageBy: c.uid, updatedAt: ts },
    outbox,
    { type: 'message.sent', threadId, messageId: id, by: c.uid, at: ts },
  );
  return message;
}
