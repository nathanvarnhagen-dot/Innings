import { collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from './client';
import type { AppNotification } from '../types/domain';

export async function listNotifications(uid: string): Promise<AppNotification[]> {
  const snapshot = await getDocs(query(collection(db, 'notifications'), where('toUid', '==', uid), limit(100)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AppNotification)).sort((a, b) => b.ts - a.ts);
}

export function markNotificationRead(id: string) {
  return updateDoc(doc(db, 'notifications', id), { read: true });
}
