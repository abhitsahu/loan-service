'use client';

import type { InstallmentResponse } from '@/app/api/model/response/installment.response';
import { cn } from '@/app/app/_util/cn';

interface Props {
  schedule: InstallmentResponse[];
}

const STATUS_BADGE: Record<string, string> = {
  PAID:           'badge badge-green',
  PARTIALLY_PAID: 'badge badge-amber',
  PENDING:        'badge badge-gray',
};

function fmt(v: string) {
  return `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export function ScheduleTable({ schedule }: Props) {
  return (
    <div className="table-wrapper">
      <table className="table" aria-label="Repayment schedule">
        <thead>
          <tr>
            <th>#</th>
            <th>Due Date</th>
            <th>Opening Balance</th>
            <th>Interest</th>
            <th>Principal</th>
            <th>Total Due</th>
            <th>Amount Paid</th>
            <th>Remaining</th>
            <th>Closing Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((row) => (
            <tr
              key={row.installmentNumber}
              className={cn(
                row.isOverdue && row.status !== 'PAID' ? 'row-overdue' : '',
                row.status === 'PAID' ? 'row-paid' : '',
              )}
            >
              <td className="mono">{row.installmentNumber}</td>
              <td>
                {row.dueDate}
                {row.isOverdue && row.status !== 'PAID' && (
                  <span className="badge badge-rose" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                    +{row.daysPastDue}d
                  </span>
                )}
              </td>
              <td className="mono">{fmt(row.openingBalance)}</td>
              <td className="mono text-warn">{fmt(row.interestComponent)}</td>
              <td className="mono">{fmt(row.principalComponent)}</td>
              <td className="mono" style={{ fontWeight: 600 }}>{fmt(row.totalDue)}</td>
              <td className="mono text-accent">{fmt(row.amountPaid)}</td>
              <td className="mono" style={{ color: parseFloat(row.remainingDue) > 0 ? 'var(--color-danger)' : 'inherit' }}>
                {fmt(row.remainingDue)}
              </td>
              <td className="mono">{fmt(row.closingBalance)}</td>
              <td>
                <span className={STATUS_BADGE[row.status] ?? 'badge badge-gray'}>
                  {row.status.replace('_', ' ')}
                </span>
                {row.settledOn && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {row.settledOn}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
