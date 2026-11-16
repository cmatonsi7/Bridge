import { COLLECTIONS, DEFAULT_EMAIL_PREFERENCES, type EmailPreferences, type UserDoc } from '@sportbridge/shared';
import type { Firestore } from 'firebase-admin/firestore';
import type { EmailRepoPort } from './email.js';

export const EMAIL_PREFERENCES = 'emailPreferences';
export const EMAIL_THROTTLE = 'emailThrottle';

/** A throttle key must survive being used as a document id. */
const throttleId = (uid: string, threadId: string) => `${uid}__${threadId}`.replace(/[^A-Za-z0-9_-]/g, '_');

export function firestoreEmailRepo(db: Firestore): EmailRepoPort {
  const prefsDoc = (uid: string) => db.collection(COLLECTIONS.users).doc(uid).collection(EMAIL_PREFERENCES).doc('self');

  const read = async (uid: string): Promise<EmailPreferences> => {
    const s = await prefsDoc(uid).get();
    // Absent means default: somebody who has never touched the setting still gets told things.
    return s.exists ? { ...DEFAULT_EMAIL_PREFERENCES, ...(s.data() as Partial<EmailPreferences>) } : { ...DEFAULT_EMAIL_PREFERENCES };
  };

  return {
    async getRecipient(uid) {
      const [userSnap, preferences] = await Promise.all([
        db.collection(COLLECTIONS.users).doc(uid).get(),
        read(uid),
      ]);
      if (!userSnap.exists) return null;
      const u = userSnap.data() as UserDoc;
      if (!u.email) return null;
      return { uid, email: u.email, displayName: u.displayName, preferences };
    },

    async lastMessageEmailAt(uid, threadId) {
      const s = await db.collection(EMAIL_THROTTLE).doc(throttleId(uid, threadId)).get();
      return s.exists ? ((s.data()?.at as string) ?? null) : null;
    },

    async markMessageEmailSent(uid, threadId, at) {
      await db.collection(EMAIL_THROTTLE).doc(throttleId(uid, threadId)).set({ uid, threadId, at });
    },

    getPreferences: read,

    async setPreferences(uid, prefs) {
      await prefsDoc(uid).set(prefs);
    },
  };
}
