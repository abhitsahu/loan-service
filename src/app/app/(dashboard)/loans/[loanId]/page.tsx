'use client';

import { use } from 'react';
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


  return (
    <div className="layout-root">
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="dot" />
          LoanService
        </div>
        <div className="topbar-user">
          <span className="topbar-email" title={user?.email ?? undefined}>{user?.email}</span>
          <button id="btn-sign-out" className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="page-header">
          <h1>Loan Dashboard</h1>
          <p className="loan-id-text">
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

            <div className="dashboard-grid">
              {/* Schedule */}
              <section className="schedule-section">
                <div className="section-header">
                  <h2>Repayment Schedule</h2>
                  <span className="table-scroll-hint">Scroll horizontally →</span>
                </div>
                <ScheduleTable schedule={loan.schedule} />
              </section>

              {/* Sidebar */}
              <aside className="sidebar-section">
                {loan.loan.status === 'ACTIVE' && (
                  <PaymentForm loanId={loanId} onSuccess={() => mutate()} />
                )}

                {/* Payment history */}
                <div className="payment-history-card">
                  <h3 style={{ marginBottom: '1rem' }}>Payment History</h3>
                  {loan.payments.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No payments yet.</p>
                  ) : (
                    <div className="payment-history-list">
                      {loan.payments.map((p) => (
                        <div key={p.id} className="payment-history-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', gap: '0.5rem' }}>
                            <span className="mono" style={{ fontWeight: 600 }}>
                              ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{p.paymentDate}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span>Allocated: ₹{parseFloat(p.allocatedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            {parseFloat(p.unallocatedAmount) > 0 && (
                              <span className="badge badge-amber">
                                Surplus: ₹{parseFloat(p.unallocatedAmount).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
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
