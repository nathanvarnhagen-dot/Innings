import type { Timestamp } from 'firebase/firestore';

export type MomentKind = 'past' | 'future';
export type Rsvp = 'going' | 'maybe' | 'no';

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  location?: string;
  interests: string[];
  profilePhotos: string[];
  customVibes: string[];
}

export interface Moment {
  id: string;
  ownerUid: string;
  kind: MomentKind;
  title: string;
  date: string;
  location?: string;
  vibe?: string;
  caption?: string;
  highlight?: string;
  dedication?: string;
  people: string[];
  taggedUids: string[];
  photos: string[];
  public: boolean;
  theme?: string;
  rsvps?: Record<string, Rsvp>;
  createdAt?: Timestamp | number;
}

export interface ChatMessage {
  id: string;
  uid: string;
  author: string;
  text: string;
  ts: number;
  reactions?: Record<string, string[]>;
}

export interface AppNotification {
  id: string;
  toUid: string;
  fromUid?: string;
  type: string;
  text: string;
  read: boolean;
  ts: number;
}
