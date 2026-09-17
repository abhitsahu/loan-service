'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';

export default function LoginPage() {
  const { user, loading, signInEmail, signInGoogle } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/app');
  }, [user, loading, router]);

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInEmail(email, password);
      router.replace('/app');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInGoogle();
      router.replace('/app');
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card fade-up">
        <div className="auth-logo">
          <span className="glow-dot" />
          <span>LoanService</span>
        </div>

        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>Welcome back</h1>
        <p style={{ marginBottom: '2rem', fontSize: '0.9rem' }}>Sign in to manage your loans</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
            {busy ? <span className="spinner" style={{ width: '1rem', height: '1rem' }} /> : 'Sign in'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.5rem 0' }}>or</div>

        <button
          id="btn-google-signin"
          type="button"
          className="btn btn-google btn-full"
          onClick={handleGoogle}
          disabled={busy}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M46.5 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h12.7c-.6 3-2.3 5.5-4.8 7.2v6h7.7c4.5-4.2 7.1-10.3 7.1-16.9z"/>
            <path fill="#34A853" d="M24 48c6.5 0 12-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9H2.5v6.2C6.4 42.9 14.6 48 24 48z"/>
            <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6V13.2H2.5C.9 16.3 0 19.8 0 23.4s.9 7.1 2.5 10.2l8-6.3v.1l-.5-.8h.5z"/>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.1 30.4 0 24 0 14.6 0 6.4 5.1 2.5 13.2l8 6.3C12.4 13.7 17.7 9.5 24 9.5z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
