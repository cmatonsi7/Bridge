import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  achievementSchema,
  athletePrivacySchema,
  athleteProfileSchema,
  type AchievementDoc,
  type AchievementInput,
  type AthletePrivacy,
  type AthleteProfileDoc,
  type AthleteProfileInput,
  type PrivateDetailsDoc,
} from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';

export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

const nowIso = () => new Date().toISOString();
const LOAD_ERROR = 'We couldn’t load this. Check your connection and refresh.';

/** Live athleteProfiles/{uid}. */
export function useAthleteProfile(uid: string | undefined): Loadable<AthleteProfileDoc | null> {
  const [state, setState] = useState<Loadable<AthleteProfileDoc | null>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(requireDb(), COLLECTIONS.athleteProfiles, uid),
      (snap) =>
        setState({ status: 'ready', data: snap.exists() ? (snap.data() as AthleteProfileDoc) : null }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [uid]);
  return state;
}

export type AchievementWithId = AchievementDoc & { id: string };

/** Live achievements, newest year first. */
export function useAchievements(uid: string | undefined): Loadable<AchievementWithId[]> {
  const [state, setState] = useState<Loadable<AchievementWithId[]>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(requireDb(), COLLECTIONS.athleteProfiles, uid, 'achievements'),
      orderBy('year', 'desc'),
    );
    return onSnapshot(
      q,
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as AchievementDoc) })),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [uid]);
  return state;
}

/** Live users/{uid}/private/details (mobile number for Settings). */
export function usePrivateDetails(uid: string | undefined): Loadable<PrivateDetailsDoc | null> {
  const [state, setState] = useState<Loadable<PrivateDetailsDoc | null>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(requireDb(), COLLECTIONS.users, uid, COLLECTIONS.privateDetails, 'details'),
      (snap) =>
        setState({ status: 'ready', data: snap.exists() ? (snap.data() as PrivateDetailsDoc) : null }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [uid]);
  return state;
}

/** Saves editable profile fields. Throws ZodError on invalid input (rules re-check on the server). */
export async function saveAthleteProfile(uid: string, input: AthleteProfileInput) {
  const fields = athleteProfileSchema.parse(input);
  await updateDoc(doc(requireDb(), COLLECTIONS.athleteProfiles, uid), { ...fields, updatedAt: nowIso() });
}

/** Name lives on users/{uid} (and is mirrored to the profile's displayName). */
export async function saveName(uid: string, firstName: string, surname: string) {
  const f = firstName.trim();
  const s = surname.trim();
  if (!f || !s || f.length > 60 || s.length > 60) throw new Error('INVALID_NAME');
  const displayName = `${f} ${s}`;
  const ts = nowIso();
  await updateDoc(doc(requireDb(), COLLECTIONS.users, uid), {
    firstName: f,
    surname: s,
    displayName,
    updatedAt: ts,
  });
  await updateDoc(doc(requireDb(), COLLECTIONS.athleteProfiles, uid), { displayName, updatedAt: ts });
}

export async function saveMobile(uid: string, mobile: string) {
  const clean = mobile.replace(/[\s()-]/g, '');
  if (!/^\+?\d{9,15}$/.test(clean)) throw new Error('INVALID_MOBILE');
  await updateDoc(doc(requireDb(), COLLECTIONS.users, uid, COLLECTIONS.privateDetails, 'details'), {
    mobile: clean,
  });
}

export async function savePrivacy(uid: string, privacy: AthletePrivacy) {
  const p = athletePrivacySchema.parse(privacy);
  await updateDoc(doc(requireDb(), COLLECTIONS.athleteProfiles, uid), { privacy: p, updatedAt: nowIso() });
}

export async function addAchievement(uid: string, input: AchievementInput) {
  const a = achievementSchema.parse(input);
  const ts = nowIso();
  await addDoc(collection(requireDb(), COLLECTIONS.athleteProfiles, uid, 'achievements'), {
    ...a,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateAchievement(uid: string, id: string, createdAt: string, input: AchievementInput) {
  const a = achievementSchema.parse(input);
  await updateDoc(doc(requireDb(), COLLECTIONS.athleteProfiles, uid, 'achievements', id), {
    ...a,
    createdAt,
    updatedAt: nowIso(),
  });
}

export async function deleteAchievement(uid: string, id: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.athleteProfiles, uid, 'achievements', id));
}

/** Age from DOB, for display only (minor status is always decided by the server). */
export function ageFromDob(dob: string | undefined): number | null {
  const m = dob ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob) : null;
  if (!m) return null;
  const now = new Date();
  let age = now.getFullYear() - Number(m[1]);
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  if (md < Number(m[2]) * 100 + Number(m[3])) age -= 1;
  return age;
}
