import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './client';
import type { Moment, Rsvp } from '../types/domain';

const pastMoments = (uid: string) => collection(db, 'users', uid, 'moments');

function fromDocument(id: string, data: Record<string, unknown>, kind: Moment['kind']): Moment {
  return {
    id,
    ownerUid: String(data.ownerUid ?? ''),
    kind,
    title: String(data.title ?? data.vibe ?? 'Untitled moment'),
    date: String(data.date ?? ''),
    location: data.location as string | undefined,
    vibe: data.vibe as string | undefined,
    caption: data.caption as string | undefined,
    highlight: data.highlight as string | undefined,
    dedication: data.dedication as string | undefined,
    people: (data.people as string[] | undefined) ?? [],
    taggedUids: (data.taggedUids as string[] | undefined) ?? [],
    photos: (data.photos as string[] | undefined) ?? [],
    public: Boolean(data.public),
    theme: data.theme as string | undefined,
    rsvps: data.rsvps as Record<string, Rsvp> | undefined,
    createdAt: data.createdAt as Moment['createdAt'],
  };
}

export async function listOwnMoments(uid: string): Promise<Moment[]> {
  const [past, future] = await Promise.all([
    getDocs(pastMoments(uid)),
    getDocs(query(collection(db, 'futureMoments'), where('ownerUid', '==', uid))),
  ]);
  return [
    ...past.docs.map((item) => fromDocument(item.id, { ...item.data(), ownerUid: uid }, 'past')),
    ...future.docs.map((item) => fromDocument(item.id, item.data(), 'future')),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export async function createMoment(uid: string, input: Omit<Moment, 'id' | 'ownerUid' | 'createdAt'>) {
  const payload = { ...input, ownerUid: uid, createdAt: serverTimestamp() };
  if (input.kind === 'future') return addDoc(collection(db, 'futureMoments'), payload);
  return addDoc(pastMoments(uid), payload);
}

export async function saveMoment(moment: Moment) {
  const target = moment.kind === 'future'
    ? doc(db, 'futureMoments', moment.id)
    : doc(db, 'users', moment.ownerUid, 'moments', moment.id);
  const { id: _id, ...values } = moment;
  void _id;
  await setDoc(target, values, { merge: true });
}

export async function removeMoment(moment: Moment) {
  const target = moment.kind === 'future'
    ? doc(db, 'futureMoments', moment.id)
    : doc(db, 'users', moment.ownerUid, 'moments', moment.id);
  await deleteDoc(target);
}

export async function setRsvp(momentId: string, uid: string, rsvp: Rsvp) {
  await updateDoc(doc(db, 'futureMoments', momentId), { [`rsvps.${uid}`]: rsvp });
}

export async function uploadMomentPhoto(uid: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const object = ref(storage, `users/${uid}/moments/${crypto.randomUUID()}-${safeName}`);
  await uploadBytes(object, file, { contentType: file.type });
  return getDownloadURL(object);
}

export function subscribeToChat(momentId: string, callback: (messages: Array<Record<string, unknown>>) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'futureMomentChat'), where('momentId', '==', momentId), orderBy('ts')),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
  );
}
