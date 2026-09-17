'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/auth-provider';

/**
 * Wraps pages that require authentication.
 * UX convenience only — the actual security is enforced server-side via requireAuth().
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/app/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
