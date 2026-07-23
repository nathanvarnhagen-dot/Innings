import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAU2VzlnSOILn7CrzWIH-HMD3YmbMr0I6s',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'innings-558fc.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'innings-558fc',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'innings-558fc.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '570364586597',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:570364586597:web:774cc634c7c143390ff48c',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
