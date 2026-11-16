import { useState } from 'react';
import { type CalendarEntryInput } from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { useMyChildren } from '../../../features/guardian/guardianService';
import { BootScreen } from '../../../app/guards';
import {
  addCalendarEntry,
  deleteCalendarEntry,
  manualAsItems,
  mergeItems,
  updateCalendarEntry,
  useApplicationEvents,
  useMyEntries,
  useMyListingEvents,
  type CalendarEntryWithId,
  type CalendarItem,
} from '../../../features/calendar/calendarService';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');
const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', { dateStyle: 'medium' });
const today = () => new Date().toISOString().slice(0, 10);

const SOURCE_LABEL: Record<CalendarItem['source'], string> = {
  manual: '',
  application: 'From your accepted application',
  listing: 'Your listing',
};

/** Calendar: entries a member types themselves, plus events derived from their applications or listings. */
export default function CalendarPage() {
  const me = useSignedInUser();
  const role = me?.user.role;
  if (!me) return <BootScreen label="Loading…" />;
  return (
    <section className="sb-page active" id="sb-page-calendar">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">SCHEDULE</div>
          <h1>Calendar</h1>
          <p>
            {role === 'guardian'
              ? 'Upcoming dates from your children’s accepted applications, plus your own reminders.'
              : 'Dates from your accepted applications or listings, plus anything you add yourself.'}
          </p>
        </div>
      </div>
      {role === 'guardian' ? <GuardianCalendar uid={me.uid} /> : <MemberCalendar uid={me.uid} role={role} />}
    </section>
  );
}

function MemberCalendar({ uid, role }: { uid: string; role: string | undefined }) {
  const mine = useMyEntries(uid);
  const applicationEvents = useApplicationEvents(role === 'athlete' ? uid : undefined);
  const listingEvents = useMyListingEvents(role === 'organisation' ? uid : undefined);
  if (
    mine.status === 'loading' ||
    applicationEvents.status === 'loading' ||
    listingEvents.status === 'loading'
  )
    return <BootScreen label="Loading your calendar…" />;
  if (mine.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {mine.message}
      </div>
    );
  const derived = mergeItems(
    applicationEvents.status === 'ready' ? applicationEvents.data : [],
    listingEvents.status === 'ready' ? listingEvents.data : [],
  );
  return <CalendarBody uid={uid} entries={mine.data} derived={derived} canAdd />;
}

function GuardianCalendar({ uid }: { uid: string }) {
  const children = useMyChildren(uid);
  const mine = useMyEntries(uid);
  if (children.status === 'loading' || mine.status === 'loading') return <BootScreen label="Loading…" />;
  if (children.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {children.message}
      </div>
    );
  if (mine.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {mine.message}
      </div>
    );
  if (children.data.length === 0)
    return (
      <>
        <div className="sb-card sb-empty">No children are connected to your account yet.</div>
        <CalendarBody uid={uid} entries={mine.data} derived={[]} canAdd />
      </>
    );
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <CalendarBody uid={uid} entries={mine.data} derived={[]} canAdd />
      {children.data.map((c) => (
        <ChildCalendar key={c.id} childUid={c.athleteUid} childName={c.athleteName ?? 'Your child'} />
      ))}
    </div>
  );
}

function ChildCalendar({ childUid, childName }: { childUid: string; childName: string }) {
  const events = useApplicationEvents(childUid);
  return (
    <div>
      <div className="sb-section-title">
        <h2>{childName}</h2>
      </div>
      {events.status === 'loading' && <p className="sb-meta">Loading…</p>}
      {events.status === 'error' && (
        <p className="sb-meta" role="alert">
          {events.message}
        </p>
      )}
      {events.status === 'ready' &&
        (events.data.length === 0 ? (
          <div className="sb-card sb-empty">Nothing coming up for {childName} yet.</div>
        ) : (
          <ItemList items={events.data} />
        ))}
    </div>
  );
}

function CalendarBody({
  uid,
  entries,
  derived,
  canAdd,
}: {
  uid: string;
  entries: CalendarEntryWithId[];
  derived: CalendarItem[];
  canAdd: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CalendarEntryWithId | null>(null);
  const items = mergeItems(derived, manualAsItems(entries));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {canAdd && (
        <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="sb-btn primary" onClick={() => setAdding(true)}>
            Add an event
          </button>
        </div>
      )}
      {adding && <EntryForm uid={uid} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />}
      {editing && (
        <EntryForm
          uid={uid}
          entry={editing}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
      {items.length === 0 ? (
        <div className="sb-card sb-empty">
          Nothing coming up. Add an event, or it will fill in on its own.
        </div>
      ) : (
        <ItemList items={items} entries={entries} onEdit={canAdd ? setEditing : undefined} uid={uid} />
      )}
    </div>
  );
}

function ItemList({
  items,
  entries = [],
  onEdit,
  uid,
}: {
  items: CalendarItem[];
  entries?: CalendarEntryWithId[];
  onEdit?: (e: CalendarEntryWithId) => void;
  uid?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(entries.map((e) => [`manual-${e.id}`, e]));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((it) => {
        const manual = byId.get(it.id);
        return (
          <div key={it.id} className="sb-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{it.title}</strong>
                {it.subtitle && <span className="sb-meta"> · {it.subtitle}</span>}
                {SOURCE_LABEL[it.source] && <p className="sb-meta">{SOURCE_LABEL[it.source]}</p>}
                {it.note && <p style={{ margin: '4px 0 0' }}>{it.note}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>{fmt(it.date)}</div>
                {it.endDate && <div className="sb-meta">to {fmt(it.endDate)}</div>}
              </div>
            </div>
            {manual && uid && (
              <div className="sb-form-actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                <button type="button" className="sb-btn" onClick={() => onEdit?.(manual)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="sb-btn"
                  onClick={() => deleteCalendarEntry(uid, manual.id).catch((e) => setError(errorText(e)))}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        );
      })}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function EntryForm({
  uid,
  entry,
  onDone,
  onCancel,
}: {
  uid: string;
  entry?: CalendarEntryWithId;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<CalendarEntryInput>(
    entry
      ? { title: entry.title, date: entry.date, endDate: entry.endDate, note: entry.note }
      : { title: '', date: today(), endDate: null, note: '' },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (entry) await updateCalendarEntry(uid, entry.id, f);
      else await addCalendarEntry(uid, f);
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div className="sb-card sb-form-card">
      <h3>{entry ? 'Edit event' : 'Add an event'}</h3>
      <div className="sb-form-grid">
        <div className="sb-field full">
          <label htmlFor="cal-title">Title</label>
          <input
            id="cal-title"
            value={f.title}
            maxLength={80}
            placeholder="Training session"
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
        </div>
        <div className="sb-field">
          <label htmlFor="cal-date">Date</label>
          <input
            id="cal-date"
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        </div>
        <div className="sb-field">
          <label htmlFor="cal-end">End date (optional)</label>
          <input
            id="cal-end"
            type="date"
            min={f.date}
            value={f.endDate ?? ''}
            onChange={(e) => setF({ ...f, endDate: e.target.value || null })}
          />
        </div>
        <div className="sb-field full">
          <label htmlFor="cal-note">Note (optional)</label>
          <textarea
            id="cal-note"
            rows={2}
            maxLength={300}
            value={f.note ?? ''}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
        </div>
      </div>
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions">
        <button type="button" className="sb-btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="sb-btn primary"
          disabled={busy || !f.title.trim() || !f.date}
          onClick={() => void submit()}
        >
          {busy ? 'Saving…' : entry ? 'Save changes' : 'Add event'}
        </button>
      </div>
    </div>
  );
}
