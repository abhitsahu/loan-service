'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/app/providers/auth-provider';
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

    loanClient.listLoans().then((body) => {
      const loans = body.success ? body.data : [];
      if (Array.isArray(loans) && loans.length > 0) {
        router.replace(`/app/loans/${loans[0].id}`);
      } else {
        setStatus('No loan found. Run `npm run db:setup` to seed one, then refresh.');
      }
    }).catch(() => {
      setStatus('Failed to load loans. Check your .env and try again.');
    });
  }, [user, loading, router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>
    </div>
  );
}
