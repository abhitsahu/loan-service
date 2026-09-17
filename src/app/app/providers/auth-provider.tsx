'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, googleProvider } from '@/app/_lib/firebase-client';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, and hourly token refresh
    const unsub = onIdTokenChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signInGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInEmail, signInGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
