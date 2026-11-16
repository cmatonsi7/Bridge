import { useRef, useState } from 'react';
import {
  CREDENTIAL_MAX_DOCS,
  CREDENTIAL_STATUS_LABELS,
  CREDENTIAL_UPLOADS_ENABLED,
  CREDENTIAL_STATUS_MESSAGES,
  credentialTypeLabel,
  type CredentialDocRecord,
} from '@sportbridge/shared';
import { useSignedInUser } from '../../../features/account/useSignedInUser';
import { BootScreen } from '../../../app/guards';
import { ApiError } from '../../../lib/apiClient';
import {
  removeCredential,
  submitCredentials,
  uploadCredential,
  useCredentials,
  type CredentialsView,
} from '../../../features/coach/credentialsService';

const errorText = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Try again.';
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { dateStyle: 'medium' }) : '—';
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Verified reads as good; awaiting review is neutral-warm; a rejection is neutral, never alarming. */
const STATUS_CLASS: Record<string, string> = {
  draft: 'closed',
  submitted: 'review',
  verified: 'live',
  rejected: 'closed',
};

/**
 * Coach credentials (Phase 5b). A coach uploads proof of their qualifications and staff read it.
 * Until that happens they cannot send connection requests, so this page has to be clear about where
 * they stand and what is still needed — a blocked coach who does not know why will simply leave.
 */
export default function CoachCredentialsPage() {
  const me = useSignedInUser();
  const isCoach = me?.user.role === 'coach';
  const { state, reload } = useCredentials(me?.uid, isCoach);

  if (!me) return <BootScreen label="Loading…" />;
  return (
    <section className="sb-page active" id="sb-page-credentials">
      <div className="sb-page-head">
        <div>
          <div className="sb-kicker">VERIFICATION</div>
          <h1>My Credentials</h1>
          <p>Your coaching qualifications, and the documents that prove them.</p>
        </div>
      </div>
      {!isCoach && (
        <div className="sb-card sb-empty">
          <p style={{ margin: 0 }}>Only coach accounts have credentials to verify.</p>
        </div>
      )}
      {isCoach && state.status === 'loading' && <BootScreen label="Loading your credentials…" />}
      {isCoach && state.status === 'error' && (
        <div className="sb-card sb-empty" role="alert">
          {state.message}
        </div>
      )}
      {isCoach && state.status === 'ready' && state.data && <Body view={state.data} onChanged={reload} />}
    </section>
  );
}

function Body({ view, onChanged }: { view: CredentialsView; onChanged: () => void }) {
  const { verification, documents, qualificationCount, canSubmit } = view;
  const locked = verification.status === 'submitted' || verification.status === 'verified';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(done);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="sb-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Verification</h2>
          <span className={`sb-status ${STATUS_CLASS[verification.status] ?? 'closed'}`}>
            {CREDENTIAL_STATUS_LABELS[verification.status]}
          </span>
        </div>
        <p className="sb-meta" style={{ marginTop: 8 }}>
          {CREDENTIAL_STATUS_MESSAGES[verification.status]}
        </p>
        {verification.status === 'submitted' && (
          <p className="sb-field-hint" style={{ marginTop: 8 }}>
            Sent for review on {fmtDate(verification.submittedAt)}.
          </p>
        )}
        {verification.status === 'rejected' && verification.decisionNote && (
          <p className="sb-form-status err" style={{ marginTop: 8 }} role="status">
            {verification.decisionNote}
          </p>
        )}
        {verification.status === 'verified' && (
          <p className="sb-field-hint" style={{ marginTop: 8 }}>
            Verified on {fmtDate(verification.decidedAt)}.
          </p>
        )}
      </div>

      <div className="sb-card" style={{ padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Documents</h2>
        {!CREDENTIAL_UPLOADS_ENABLED ? (
          <>
            <p className="sb-meta">
              Document uploads are not switched on yet. Nothing is needed from you for now.
            </p>
            <p className="sb-field-hint">
              In the meantime you can add your qualifications on your profile. When uploads open,
              SportBridge will ask you for proof of each one, and only you and SportBridge staff will
              ever see those documents.
            </p>
          </>
        ) : (
          <>
            <p className="sb-meta">
              Upload proof of each qualification — a certificate, a licence or a letter. PDF, JPEG or
              PNG, up to 5 MB each, {CREDENTIAL_MAX_DOCS} documents at most.
            </p>
            <p className="sb-field-hint">
              Only you and SportBridge staff can ever see these. They are never shown on your profile or
              in the Talent Directory.
            </p>
          </>
        )}

        {!CREDENTIAL_UPLOADS_ENABLED ? null : documents.length === 0 ? (
          <p className="sb-meta" style={{ marginTop: 12 }}>
            Nothing uploaded yet.
          </p>
        ) : (
          <ul className="sb-doc-list">
            {documents.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                locked={locked || busy}
                onRemove={() => act(() => removeCredential(d.id), `Removed ${d.fileName}.`)}
              />
            ))}
          </ul>
        )}

        {CREDENTIAL_UPLOADS_ENABLED && !locked && documents.length < CREDENTIAL_MAX_DOCS && (
          <UploadControl
            busy={busy}
            onPick={(file) => act(() => uploadCredential(file, null), `Uploaded ${file.name}.`)}
          />
        )}
      </div>

      <div className="sb-card" style={{ padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Send for review</h2>
        {!CREDENTIAL_UPLOADS_ENABLED && (
          <p className="sb-meta">
            Reviews are not open yet. SportBridge will let you know when you can send your
            qualifications in — there is nothing to do until then.
          </p>
        )}
        {CREDENTIAL_UPLOADS_ENABLED && qualificationCount === 0 && (
          <p className="sb-meta">
            Add at least one qualification on your profile first, then upload a document proving it.
          </p>
        )}
        {CREDENTIAL_UPLOADS_ENABLED && qualificationCount > 0 && documents.length === 0 && (
          <p className="sb-meta">Upload at least one document proving a qualification.</p>
        )}
        {canSubmit && (
          <p className="sb-meta">
            SportBridge will read your {documents.length === 1 ? 'document' : `${documents.length} documents`}{' '}
            and let you know.
          </p>
        )}
        {verification.status === 'submitted' && (
          <p className="sb-meta">Your documents are with SportBridge. Nothing more to do for now.</p>
        )}
        {verification.status === 'verified' && (
          <p className="sb-meta">You are verified. Nothing more to do.</p>
        )}
        {notice && (
          <p className="sb-form-status" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="sb-form-status err" role="alert">
            {error}
          </p>
        )}
        <div className="sb-form-actions">
          <button
            type="button"
            className="sb-btn primary"
            disabled={!canSubmit || busy}
            onClick={() => void act(submitCredentials, 'Sent to SportBridge for review.')}
          >
            {busy ? 'Working…' : 'Send for review'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  locked,
  onRemove,
}: {
  doc: CredentialDocRecord;
  locked: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="sb-doc-row">
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{doc.fileName}</strong>
        <span className="sb-meta">
          {credentialTypeLabel(doc.contentType)} · {kb(doc.sizeBytes)} · uploaded{' '}
          {fmtDate(doc.uploadedAt)}
        </span>
      </div>
      <button type="button" className="sb-btn" disabled={locked} onClick={onRemove}>
        Remove
      </button>
    </li>
  );
}

function UploadControl({ busy, onPick }: { busy: boolean; onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 6, justifyItems: 'start' }}>
      <label htmlFor="sb-credential-file">Add a document</label>
      <input
        id="sb-credential-file"
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Clearing the input lets the same file be picked again after a failure.
          if (input.current) input.current.value = '';
          if (file) onPick(file);
        }}
      />
    </div>
  );
}
