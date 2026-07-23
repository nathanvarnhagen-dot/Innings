import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { auth } from '../firebase/client';
import { getProfile } from '../firebase/profiles';
import type { Profile } from '../types/domain';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!auth.currentUser) return setProfile(null);
    setProfile(await getProfile(auth.currentUser.uid));
  };

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    setProfile(nextUser ? await getProfile(nextUser.uid) : null);
    setLoading(false);
  }), []);

  const value = useMemo(() => ({ user, profile, loading, refreshProfile }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
