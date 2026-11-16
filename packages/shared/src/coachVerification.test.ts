import { describe, expect, it } from 'vitest';
import {
  canSubmit,
  coachCanConnect,
  credentialDecisionSchema,
  credentialStoragePath,
  credentialTypeLabel,
  registerCredentialDocSchema,
  CREDENTIAL_MAX_BYTES,
} from './coachVerification.js';

describe('the connection gate', () => {
  it('lets a verified coach connect and stops everyone else', () => {
    expect(coachCanConnect('verified')).toBe(true);
    expect(coachCanConnect('submitted')).toBe(false);
    expect(coachCanConnect('draft')).toBe(false);
    expect(coachCanConnect('rejected')).toBe(false);
    // A coach who has never started the process at all.
    expect(coachCanConnect(undefined)).toBe(false);
  });
});

describe('when a coach may send their documents in', () => {
  it('needs at least one qualification and one document', () => {
    expect(canSubmit('draft', 0, 0)).toBe(false);
    expect(canSubmit('draft', 1, 0)).toBe(false);
    expect(canSubmit('draft', 0, 1)).toBe(false);
    expect(canSubmit('draft', 1, 1)).toBe(true);
  });

  it('lets a rejected coach try again but will not take a second submission or re-verify', () => {
    expect(canSubmit('rejected', 1, 1)).toBe(true);
    expect(canSubmit('submitted', 1, 1)).toBe(false);
    expect(canSubmit('verified', 1, 1)).toBe(false);
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
