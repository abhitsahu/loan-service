'use client';

import type { PositionResponse } from '@/app/api/model/response/position.response';
import type { LoanResponse } from '@/app/api/model/response/loan.response';
import { cn } from '@/app/app/_util/cn';

interface Props {
  loan: LoanResponse;
  position: PositionResponse;
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="position-stat">
      <div className="label">{label}</div>
      <div className={cn('value', accent ?? '')}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function PositionCard({ loan, position }: Props) {
  const isOverdue = parseFloat(position.overdueAmount) > 0;

  return (
    <div className="card fade-up" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>Loan Position</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>As of {position.asOf}</p>
        </div>
        <span className={cn('badge', loan.status === 'CLOSED' ? 'badge-green' : 'badge-blue')}>
          {loan.status === 'CLOSED' ? '✓ Closed' : '● Active'}
        </span>
      </div>

      <div className="position-grid">
        <Stat
          label="Outstanding Principal"
          value={`₹${parseFloat(position.outstandingPrincipal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          accent="text-primary-brand"
        />
        <Stat
          label="Total Outstanding"
          value={`₹${parseFloat(position.outstandingTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
        />
        <Stat
          label="Total Paid"
          value={`₹${parseFloat(position.totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          accent="text-accent"
        />
        {position.nextDueDate && (
          <Stat
            label="Next Due"
            value={`₹${parseFloat(position.nextDueAmount ?? '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            sub={position.nextDueDate}
          />
        )}
        {isOverdue && (
          <Stat
            label="Overdue Amount"
            value={`₹${parseFloat(position.overdueAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            sub={`${position.daysPastDue} day(s) past due`}
            accent="text-danger"
          />
        )}
      </div>

      {/* Loan meta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 2rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        {[
          ['Principal', `₹${parseFloat(loan.principal).toLocaleString('en-IN')}`],
          ['Rate', `${loan.annualInterestRate}% p.a.`],
          ['Tenure', `${loan.tenureMonths} months`],
          ['EMI', `₹${parseFloat(loan.emiAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
          ['Disbursed', loan.disbursementDate],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
