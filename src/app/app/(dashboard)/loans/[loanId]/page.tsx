'use client';

import { use, useEffect } from 'react';
import { useAuth } from '@/app/app/providers/auth-provider';
import { AuthGate } from '@/app/app/_components/auth-gate';
import { useLoan } from '@/app/app/_hooks/use-loan';
import { PositionCard } from '@/app/app/_components/position-card';
import { ScheduleTable } from '@/app/app/_components/schedule-table';
import { PaymentForm } from '@/app/app/_components/payment-form';

interface Props {
  params: Promise<{ loanId: string }>;
}

function LoanDashboard({ loanId }: { loanId: string }) {
  const { user, signOut } = useAuth();
  const { loan, isLoading, error, mutate } = useLoan(loanId);

  // Remember last visited loan
  useEffect(() => {
    if (loanId) localStorage.setItem('lastLoanId', loanId);
  }, [loanId]);

  return (
    <div className="layout-root">
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="dot" />
          LoanService
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{user?.email}</span>
          <button id="btn-sign-out" className="btn btn-ghost" onClick={signOut} style={{ padding: '0.4rem 0.875rem', fontSize: '0.875rem' }}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main-content">
        <div style={{ marginBottom: '2rem' }}>
          <h1>Loan Dashboard</h1>
          <p style={{ fontFamily: 'var(--mono, monospace)', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {loanId}
          </p>
        </div>

        {isLoading && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <div className="spinner" /> Loading loan data…
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <span>⚠</span> {error.message}
          </div>
        )}

        {loan && (
          <>
            <PositionCard loan={loan.loan} position={loan.position} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
              {/* Schedule */}
              <div>
                <h2 style={{ marginBottom: '1rem' }}>Repayment Schedule</h2>
                <ScheduleTable schedule={loan.schedule} />
              </div>

              {/* Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {loan.loan.status === 'ACTIVE' && (
                  <PaymentForm loanId={loanId} onSuccess={() => mutate()} />
                )}

                {/* Payment history */}
                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>Payment History</h3>
                  {loan.payments.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No payments yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {loan.payments.map((p) => (
                        <div key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>
                              ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{p.paymentDate}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Allocated: ₹{parseFloat(p.allocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            {parseFloat(p.unallocatedAmount) > 0 && (
                              <span className="badge badge-amber" style={{ marginLeft: '0.5rem' }}>
                                Surplus: ₹{parseFloat(p.unallocatedAmount).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function LoanPage({ params }: Props) {
  const { loanId } = use(params);

  return (
    <AuthGate>
      <LoanDashboard loanId={loanId} />
    </AuthGate>
  );
}
