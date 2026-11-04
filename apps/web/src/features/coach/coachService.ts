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
  coachPrivacySchema,
  coachProfileSchema,
  qualificationSchema,
  type CoachPrivacy,
  type CoachProfileDoc,
  type CoachProfileInput,
  type QualificationDoc,
  type QualificationInput,
} from '@sportbridge/shared';
import { requireDb } from '../../lib/firebase';
import type { Loadable } from '../athlete/athleteService';

const nowIso = () => new Date().toISOString();
const LOAD_ERROR = 'We couldn’t load this. Check your connection and refresh.';
const QUALS = 'qualifications';

export function useCoachProfile(uid: string | undefined): Loadable<CoachProfileDoc | null> {
  const [state, setState] = useState<Loadable<CoachProfileDoc | null>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(requireDb(), COLLECTIONS.coachProfiles, uid),
      (snap) => setState({ status: 'ready', data: snap.exists() ? (snap.data() as CoachProfileDoc) : null }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [uid]);
  return state;
}

export type QualificationWithId = QualificationDoc & { id: string };

export function useQualifications(uid: string | undefined): Loadable<QualificationWithId[]> {
  const [state, setState] = useState<Loadable<QualificationWithId[]>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(requireDb(), COLLECTIONS.coachProfiles, uid, QUALS), orderBy('createdAt', 'desc')),
      (snap) =>
        setState({
          status: 'ready',
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as QualificationDoc) })),
        }),
      () => setState({ status: 'error', message: LOAD_ERROR }),
    );
  }, [uid]);
  return state;
}

export async function saveCoachProfile(uid: string, input: CoachProfileInput) {
  const fields = coachProfileSchema.parse(input);
  await updateDoc(doc(requireDb(), COLLECTIONS.coachProfiles, uid), { ...fields, updatedAt: nowIso() });
}

/** Name lives on users/{uid}, mirrored to coachProfiles/{uid}.displayName. */
export async function saveCoachName(uid: string, firstName: string, surname: string) {
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
  await updateDoc(doc(requireDb(), COLLECTIONS.coachProfiles, uid), { displayName, updatedAt: ts });
}

export async function saveCoachPrivacy(uid: string, privacy: CoachPrivacy) {
  const p = coachPrivacySchema.parse(privacy);
  await updateDoc(doc(requireDb(), COLLECTIONS.coachProfiles, uid), { privacy: p, updatedAt: nowIso() });
}

export async function addQualification(uid: string, input: QualificationInput) {
  const q = qualificationSchema.parse(input);
  const ts = nowIso();
  await addDoc(collection(requireDb(), COLLECTIONS.coachProfiles, uid, QUALS), {
    ...q,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateQualification(
  uid: string,
  id: string,
  createdAt: string,
  input: QualificationInput,
) {
  const q = qualificationSchema.parse(input);
  await updateDoc(doc(requireDb(), COLLECTIONS.coachProfiles, uid, QUALS, id), {
    ...q,
    createdAt,
    updatedAt: nowIso(),
  });
}

export async function deleteQualification(uid: string, id: string) {
  await deleteDoc(doc(requireDb(), COLLECTIONS.coachProfiles, uid, QUALS, id));
}
