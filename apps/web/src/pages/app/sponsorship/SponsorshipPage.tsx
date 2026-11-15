import { useState } from 'react';
import {
  PROVINCES,
  SPONSORSHIP_CATEGORIES,
  SPONSORSHIP_DAYS,
  SPONSORSHIP_STATUS_LABELS,
  SPORTS,
  isLiveRequest,
  type SponsorshipRequestInput,
} from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { BootScreen } from '../../../app/guards';
import {
  answerOffer,
  closeSponsorshipRequest,
  createSponsorshipRequest,
  daysLeft,
  offerHelp,
  rand,
  reportSponsorshipRequest,
  useMyRequests,
  useOffersMade,
  useOffersReceived,
  useOpenRequests,
  withdrawOffer,
  type OfferWithId,
  type RequestWithId,
} from '../../../features/sponsorship/sponsorshipService';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** Sponsorship: athletes ask, and athletes, coaches and organisations offer help. SportBridge handles no money. */
export default function SponsorshipPage() {
  const me = useSignedInUser();
  const role = me?.user.role;
  const canAsk = role === 'athlete' && me?.user.isMinor !== true;
  const canOffer = role === 'coach' || role === 'organisation' || canAsk;
  const tabs = [
    ...(canAsk ? [{ key: 'mine', label: 'My request' }] : []),
    ...(canOffer ? [{ key: 'browse', label: 'Requests for support' }] : []),
    ...(canOffer ? [{ key: 'offers', label: 'Offers I made' }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.key ?? 'browse');

  return (
    <section className="sb-page active" id="sb-page-sponsorship">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">ATHLETE SUPPORT</div>
          <h1>{canAsk ? 'Sponsorship Centre' : 'Support athletes'}</h1>
          <p>
            Athletes ask for help with a sporting cost, and people who want to help offer it. SportBridge
            introduces you once the athlete accepts. SportBridge never handles money.
          </p>
        </div>
      </div>
      {me?.user.isMinor ? (
        <div className="sb-card sb-empty">
          Under-18s cannot ask for sponsorship on SportBridge. A parent or guardian will be able to ask for
          you once this opens.
        </div>
      ) : (
        <>
          <nav className="sb-tabs" aria-label="Sponsorship sections">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-current={tab === t.key ? 'page' : undefined}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {tab === 'mine' && me && <MyRequest uid={me.uid} />}
          {tab === 'browse' && me && <Browse uid={me.uid} />}
          {tab === 'offers' && me && <OffersMade uid={me.uid} />}
        </>
      )}
    </section>
  );
}

function MyRequest({ uid }: { uid: string }) {
  const mine = useMyRequests(uid);
  const received = useOffersReceived(uid);
  if (mine.status === 'loading') return <BootScreen label="Loading your request…" />;
  if (mine.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {mine.message}
      </div>
    );
  const current = mine.data.find((r) => isLiveRequest(r) || r.status === 'pending_review');
  const past = mine.data.filter((r) => r !== current);
  const offers = received.status === 'ready' ? received.data : [];
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {current ? (
        <RequestCard r={current} own offers={offers.filter((o) => o.requestId === current.id)} />
      ) : (
        <RequestForm />
      )}
      {past.length > 0 && (
        <>
          <div className="sb-section-title">
            <h2>Earlier requests</h2>
          </div>
          {past.map((r) => (
            <RequestCard key={r.id} r={r} own offers={offers.filter((o) => o.requestId === r.id)} />
          ))}
        </>
      )}
    </div>
  );
}

function RequestForm() {
  const [f, setF] = useState<SponsorshipRequestInput>({
    title: '',
    story: '',
    category: 'Kit & equipment',
    amountZar: 0,
    sport: 'Football',
    province: 'Gauteng',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof SponsorshipRequestInput) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createSponsorshipRequest({ ...f, amountZar: Number(f.amountZar) });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div className="sb-card sb-form-card">
      <h3>Ask for support</h3>
      <p className="sb-meta" style={{ lineHeight: 1.6 }}>
        Your request is shown to signed-in members for {SPONSORSHIP_DAYS} days with your first name and
        surname initial, your sport and your province. Your contact details are only shared with someone whose
        offer you accept.
      </p>
      <div className="sb-form-grid">
        <div className="sb-field full">
          <label htmlFor="sp-title">What do you need?</label>
          <input
            id="sp-title"
            value={f.title}
            onChange={set('title')}
            maxLength={80}
            placeholder="Boots for the league season"
          />
        </div>
        <div className="sb-field full">
          <label htmlFor="sp-story">Tell people about it</label>
          <textarea id="sp-story" value={f.story} onChange={set('story')} maxLength={600} rows={4} />
          <span className="sb-field-hint">
            {f.story.length}/600. Don’t include phone numbers or addresses.
          </span>
        </div>
        <div className="sb-field">
          <label htmlFor="sp-cat">Type of cost</label>
          <select id="sp-cat" value={f.category} onChange={set('category')}>
            {SPONSORSHIP_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="sb-field">
          <label htmlFor="sp-amount">Roughly how much (rand)</label>
          <input
            id="sp-amount"
            type="number"
            min={50}
            max={100000}
            value={f.amountZar || ''}
            onChange={set('amountZar')}
          />
        </div>
        <div className="sb-field">
          <label htmlFor="sp-sport">Sport</label>
          <select id="sp-sport" value={f.sport} onChange={set('sport')}>
            {SPORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="sb-field">
          <label htmlFor="sp-prov">Province</label>
          <select id="sp-prov" value={f.province} onChange={set('province')}>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions">
        <button type="button" className="sb-btn primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Posting…' : 'Post my request'}
        </button>
      </div>
    </div>
  );
}

function RequestCard({
  r,
  own = false,
  offers = [],
}: {
  r: RequestWithId;
  own?: boolean;
  offers?: OfferWithId[];
}) {
  const live = isLiveRequest(r);
  const status = r.status === 'open' && !live ? 'Expired' : SPONSORSHIP_STATUS_LABELS[r.status];
  const [error, setError] = useState<string | null>(null);
  return (
    <article className="sb-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{r.title}</h3>
          <p className="sb-meta">
            {r.displayName ?? 'Young athlete'} · {r.ageBand} · {r.sport} · {r.province}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>{rand(r.amountZar)}</strong>
          <div className="sb-meta">
            {r.category}
            {live && ` · ${daysLeft(r.expiresAt)} days left`}
          </div>
        </div>
      </div>
      <p style={{ lineHeight: 1.6, margin: '10px 0' }}>{r.story}</p>
      {own && (
        <>
          <p className="sb-meta">
            Status: <strong>{status}</strong>
            {r.reviewNote ? ` · ${r.reviewNote}` : ''} · {r.offerCount} offer{r.offerCount === 1 ? '' : 's'}
          </p>
          {offers.length > 0 && (
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {offers.map((o) => (
                <OfferReceived key={o.id} o={o} />
              ))}
            </div>
          )}
          {(live || r.status === 'pending_review') && (
            <button
              type="button"
              className="sb-btn"
              style={{ marginTop: 10 }}
              onClick={() => closeSponsorshipRequest(r.id).catch((e) => setError(errorText(e)))}
            >
              Close this request
            </button>
          )}
        </>
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function OfferReceived({ o }: { o: OfferWithId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (accept: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await answerOffer(o.id, accept);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };
  return (
    <div className="sb-form-card" style={{ padding: 12 }}>
      <p style={{ margin: 0 }}>
        <strong>{o.offererName}</strong> <span className="sb-meta">({o.offererRole})</span>
      </p>
      <p style={{ lineHeight: 1.6, margin: '6px 0' }}>“{o.message}”</p>
      {o.status === 'pending' ? (
        <div className="sb-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="sb-btn primary" disabled={busy} onClick={() => void act(true)}>
            Accept and share emails
          </button>
          <button type="button" className="sb-btn" disabled={busy} onClick={() => void act(false)}>
            Decline
          </button>
        </div>
      ) : o.status === 'accepted' && o.contacts ? (
        <p className="sb-meta">
          Accepted. Contact them at{' '}
          <a href={`mailto:${o.contacts.offererEmail}`}>{o.contacts.offererEmail}</a>. Any money is between
          you and them; SportBridge is not involved.
        </p>
      ) : (
        <p className="sb-meta">
          {o.status === 'declined' ? 'You declined this offer.' : 'They withdrew this offer.'}
        </p>
      )}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Browse({ uid }: { uid: string }) {
  const open = useOpenRequests();
  const made = useOffersMade(uid);
  if (open.status === 'loading') return <BootScreen label="Loading requests…" />;
  if (open.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {open.message}
      </div>
    );
  const offered = new Set(made.status === 'ready' ? made.data.map((o) => o.requestId) : []);
  const list = open.data.filter((r) => isLiveRequest(r) && r.requesterUid !== uid);
  if (!list.length)
    return (
      <div className="sb-card sb-empty">No athletes are asking for support right now. Check back soon.</div>
    );
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {list.map((r) => (
        <div key={r.id}>
          <RequestCard r={r} />
          <OfferBox r={r} offered={offered.has(r.id)} />
        </div>
      ))}
    </div>
  );
}

function OfferBox({ r, offered }: { r: RequestWithId; offered: boolean }) {
  const [mode, setMode] = useState<'idle' | 'offer' | 'report' | 'reported'>('idle');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (offered && mode !== 'report')
    return <p className="sb-field-hint">You offered to help with this request.</p>;
  if (mode === 'reported')
    return <p className="sb-field-hint">Thank you. SportBridge staff will look at it.</p>;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'offer') await offerHelp(r.id, text);
      else await reportSponsorshipRequest(r.id, text);
      setMode(mode === 'report' ? 'reported' : 'idle');
      setText('');
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };
  if (mode === 'idle')
    return (
      <div className="sb-form-actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
        <button type="button" className="sb-btn primary" onClick={() => setMode('offer')}>
          Offer to help
        </button>
        <button type="button" className="sb-btn" onClick={() => setMode('report')}>
          Report
        </button>
      </div>
    );
  const id = `${mode}-${r.id}`;
  return (
    <div className="sb-card sb-form-card" style={{ marginTop: 8 }}>
      <div className="sb-field full">
        <label htmlFor={id}>
          {mode === 'offer' ? 'Your message to the athlete' : 'What is wrong with this request?'}
        </label>
        <textarea
          id={id}
          rows={3}
          maxLength={mode === 'offer' ? 400 : 300}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {mode === 'offer' && (
          <span className="sb-field-hint">
            Your email is only shared if they accept. Don’t include phone numbers or bank details.
          </span>
        )}
      </div>
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
      <div className="sb-form-actions">
        <button type="button" className="sb-btn" disabled={busy} onClick={() => setMode('idle')}>
          Cancel
        </button>
        <button
          type="button"
          className="sb-btn primary"
          disabled={busy || !text.trim()}
          onClick={() => void send()}
        >
          {mode === 'offer' ? 'Send offer' : 'Send report'}
        </button>
      </div>
    </div>
  );
}

function OffersMade({ uid }: { uid: string }) {
  const made = useOffersMade(uid);
  const [error, setError] = useState<string | null>(null);
  if (made.status === 'loading') return <BootScreen label="Loading your offers…" />;
  if (made.status === 'error')
    return (
      <div className="sb-card sb-empty" role="alert">
        {made.message}
      </div>
    );
  if (!made.data.length)
    return <div className="sb-card sb-empty">You haven’t offered to help anyone yet.</div>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {made.data.map((o) => (
        <div className="sb-card" style={{ padding: 16 }} key={o.id}>
          <h3 style={{ margin: 0 }}>{o.requestTitle}</h3>
          <p style={{ lineHeight: 1.6 }}>“{o.message}”</p>
          {o.status === 'pending' && (
            <>
              <p className="sb-meta">Waiting for the athlete to answer.</p>
              <button
                type="button"
                className="sb-btn"
                onClick={() => withdrawOffer(o.id).catch((e) => setError(errorText(e)))}
              >
                Withdraw my offer
              </button>
            </>
          )}
          {o.status === 'accepted' && o.contacts && (
            <p className="sb-meta">
              Accepted. Contact them at{' '}
              <a href={`mailto:${o.contacts.requesterEmail}`}>{o.contacts.requesterEmail}</a>. Any money is
              between you and them; SportBridge is not involved.
            </p>
          )}
          {o.status === 'declined' && (
            <p className="sb-meta">They declined this offer. Thank you for offering.</p>
          )}
          {o.status === 'withdrawn' && <p className="sb-meta">You withdrew this offer.</p>}
        </div>
      ))}
      {error && (
        <p className="sb-form-status err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
