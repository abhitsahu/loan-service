'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers/auth-provider';
import { loanClient } from '@/app/api/client/loan-client';

export default function AppLanding() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState('Loading…');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/app/login');
      return;
    }

    // Try to find the first available loan via the API and redirect there.
    // For now we store the last visited loanId in localStorage.
    const lastId = localStorage.getItem('lastLoanId');
    if (lastId) {
      router.replace(`/app/loans/${lastId}`);
    } else {
      setStatus('No loan found. Create one via POST /api/loans and navigate to /app/loans/<id>.');
    }
  }, [user, loading, router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>
    </div>
  );
}
