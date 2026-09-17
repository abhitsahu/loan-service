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
            <th className="text-center">#</th>
            <th className="text-left">Due Date</th>
            <th className="text-right">Opening Balance</th>
            <th className="text-right">Interest</th>
            <th className="text-right">Principal</th>
            <th className="text-right">Total Due</th>
            <th className="text-right">Amount Paid</th>
            <th className="text-right">Remaining</th>
            <th className="text-right">Closing Balance</th>
            <th className="text-left">Status</th>
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
              <td className="mono text-center">{row.installmentNumber}</td>
              <td className="text-left">
                <span className="mono">{row.dueDate}</span>
                {row.isOverdue && row.status !== 'PAID' && (
                  <span className="badge badge-rose" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                    +{row.daysPastDue}d
                  </span>
                )}
              </td>
              <td className="mono text-right">{fmt(row.openingBalance)}</td>
              <td className="mono text-warn text-right">{fmt(row.interestComponent)}</td>
              <td className="mono text-right">{fmt(row.principalComponent)}</td>
              <td className="mono text-right" style={{ fontWeight: 600 }}>{fmt(row.totalDue)}</td>
              <td className="mono text-accent text-right">{fmt(row.amountPaid)}</td>
              <td className="mono text-right" style={{ color: parseFloat(row.remainingDue) > 0 ? 'var(--color-danger)' : 'inherit' }}>
                {fmt(row.remainingDue)}
              </td>
              <td className="mono text-right">{fmt(row.closingBalance)}</td>
              <td className="text-left">
                <span className={STATUS_BADGE[row.status] ?? 'badge badge-gray'}>
                  {row.status.replace('_', ' ')}
                </span>
                {row.settledOn && (
                  <span className="mono" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
