import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './client';
import type { Profile } from '../types/domain';

const profileRef = (uid: string) => doc(db, 'users', uid);

export async function getProfile(uid: string): Promise<Profile | null> {
  const snapshot = await getDoc(profileRef(uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name ?? '',
    phone: data.phone,
    location: data.location,
    interests: data.interests ?? [],
    profilePhotos: data.profilePhotos ?? (data.profilePhoto ? [data.profilePhoto] : []),
    customVibes: data.customVibes ?? [],
  };
}

export async function createProfile(uid: string, name: string, phone?: string) {
  await setDoc(profileRef(uid), { name, phone: phone ?? null, createdAt: serverTimestamp() }, { merge: true });
}

export async function updateProfile(uid: string, values: Partial<Omit<Profile, 'id'>>) {
  await updateDoc(profileRef(uid), values);
}
