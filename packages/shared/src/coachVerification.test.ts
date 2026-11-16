import { describe, expect, it } from 'vitest';
import {
  canSubmit,
  coachCanConnect,
  credentialDecisionSchema,
  credentialStoragePath,
  credentialTypeLabel,
  registerCredentialDocSchema,
  CREDENTIAL_MAX_BYTES,
  CREDENTIAL_STATUS_MESSAGES,
  CREDENTIAL_UPLOADS_ENABLED,
  CONNECTION_REQUIRES_VERIFICATION,
} from './coachVerification.js';

describe('the connection gate', () => {
  it('lets a verified coach connect and stops everyone else, when the gate is on', () => {
    const gated = (s: Parameters<typeof coachCanConnect>[0]) => coachCanConnect(s, true);
    expect(gated('verified')).toBe(true);
    expect(gated('submitted')).toBe(false);
    expect(gated('draft')).toBe(false);
    expect(gated('rejected')).toBe(false);
    // A coach who has never started the process at all.
    expect(gated(undefined)).toBe(false);
  });

  it('lets everyone connect when the gate is off, whatever their status', () => {
    for (const s of ['verified', 'submitted', 'draft', 'rejected', undefined] as const) {
      expect(coachCanConnect(s, false)).toBe(true);
    }
  });

  it('is currently OFF, because Storage is not provisioned and nobody can complete verification', () => {
    // Blocking every coach from a process they cannot finish would be worse than postponing the check.
    // This flips to true in the same commit that turns CREDENTIAL_UPLOADS_ENABLED on.
    expect(CONNECTION_REQUIRES_VERIFICATION).toBe(false);
    expect(coachCanConnect(undefined)).toBe(true);
  });
});

describe('when a coach may send their documents in', () => {
  const withUploads = (s: Parameters<typeof canSubmit>[0], q: number, d: number) =>
    canSubmit(s, q, d, true);

  it('needs at least one qualification and one document', () => {
    expect(withUploads('draft', 0, 0)).toBe(false);
    expect(withUploads('draft', 1, 0)).toBe(false);
    expect(withUploads('draft', 0, 1)).toBe(false);
    expect(withUploads('draft', 1, 1)).toBe(true);
  });

  it('lets a rejected coach try again but will not take a second submission or re-verify', () => {
    expect(withUploads('rejected', 1, 1)).toBe(true);
    expect(withUploads('submitted', 1, 1)).toBe(false);
    expect(withUploads('verified', 1, 1)).toBe(false);
  });

  it('takes no submission at all while uploads are off, so staff never get an empty review', () => {
    expect(CREDENTIAL_UPLOADS_ENABLED).toBe(false);
    expect(canSubmit('draft', 1, 1)).toBe(false);
    expect(canSubmit('draft', 5, 5, false)).toBe(false);
  });
});

describe('what the coach is told', () => {
  it('promises no check that cannot happen, and threatens no block that is not in force', () => {
    // With uploads off, the draft message must not ask for documents or mention being blocked.
    expect(CREDENTIAL_STATUS_MESSAGES.draft).not.toMatch(/upload proof/i);
    expect(CREDENTIAL_STATUS_MESSAGES.draft).not.toMatch(/cannot send connection requests/i);
    expect(CREDENTIAL_STATUS_MESSAGES.draft).toMatch(/not open yet/i);
    // And the verified message must not claim the badge unlocks something it does not.
    expect(CREDENTIAL_STATUS_MESSAGES.verified).not.toMatch(/you can send connection requests/i);
  });
});

describe('uploaded documents', () => {
  const good = {
    qualificationId: 'q1',
    fileName: 'level-2-certificate.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    storagePath: 'coachCredentials/coach1/doc1',
  };

  it('accepts a PDF, JPEG or PNG', () => {
    expect(registerCredentialDocSchema.safeParse(good).success).toBe(true);
    expect(registerCredentialDocSchema.safeParse({ ...good, contentType: 'image/png' }).success).toBe(true);
  });

  it('refuses anything else, with a message a coach can act on', () => {
    const r = registerCredentialDocSchema.safeParse({ ...good, contentType: 'application/zip' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('Upload a PDF, JPEG or PNG');
  });

  it('refuses an empty file and one over 5 MB', () => {
    expect(registerCredentialDocSchema.safeParse({ ...good, sizeBytes: 0 }).success).toBe(false);
    expect(
      registerCredentialDocSchema.safeParse({ ...good, sizeBytes: CREDENTIAL_MAX_BYTES + 1 }).success,
    ).toBe(false);
  });

  it('treats an unlinked document as fine', () => {
    expect(registerCredentialDocSchema.parse({ ...good, qualificationId: '' }).qualificationId).toBeNull();
  });

  it('keeps each coach documents under their own uid', () => {
    expect(credentialStoragePath('coach1', 'doc1')).toBe('coachCredentials/coach1/doc1');
  });

  it('names the file type in words a coach recognises', () => {
    expect(credentialTypeLabel('application/pdf')).toBe('PDF');
    expect(credentialTypeLabel('image/png')).toBe('PNG image');
    expect(credentialTypeLabel('image/jpeg')).toBe('JPEG image');
  });
});

describe('the staff decision', () => {
  it('keeps the two notes apart — one for the coach, one for staff', () => {
    const d = credentialDecisionSchema.parse({
      verified: false,
      decisionNote: 'The certificate was unreadable.',
      internalNote: 'Scan is cut off.',
    });
    expect(d.decisionNote).toBe('The certificate was unreadable.');
    expect(d.internalNote).toBe('Scan is cut off.');
  });

  it('allows a verification with no note at all', () => {
    const d = credentialDecisionSchema.parse({ verified: true });
    expect(d.verified).toBe(true);
    expect(d.decisionNote).toBeNull();
    expect(d.internalNote).toBeNull();
  });

  it('refuses a note long enough to be a document of its own', () => {
    expect(
      credentialDecisionSchema.safeParse({ verified: false, decisionNote: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});
