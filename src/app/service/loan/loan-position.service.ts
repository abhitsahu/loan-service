import { Prisma } from '@prisma/client';
import { ZERO } from '@/lib/money';

export interface InstallmentRow {
  id: string;
  installmentNumber: number;
  dueDate: Date;
  principalComponent: Prisma.Decimal;
  interestComponent: Prisma.Decimal;
  totalDue: Prisma.Decimal;
  principalPaid: Prisma.Decimal;
  interestPaid: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  status: string;
}

export interface LoanPosition {
  outstandingPrincipal: Prisma.Decimal;
  outstandingTotal: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  nextDueDate: Date | null;
  nextDueAmount: Prisma.Decimal | null;
  overdueAmount: Prisma.Decimal;
  overdueInstallmentCount: number;
  daysPastDue: number;
  status: 'ACTIVE' | 'CLOSED';
}

/**
 * Derives the loan position from the installment schedule and a reference date.
 * Pure function — no DB access.
 *
 * nextDue = earliest unsettled installment (whether overdue or not).
 * nextDueAmount = remaining balance on that installment (totalDue - amountPaid).
 * overdueAmount = sum of remaining balances where dueDate < asOf AND status != PAID.
 * daysPastDue = days from oldest overdue due_date to asOf (0 if nothing overdue).
 */
export function computePosition(rows: InstallmentRow[], asOf: Date): LoanPosition {
  let outstandingPrincipal = ZERO;
  let outstandingTotal = ZERO;
  let totalPaid = ZERO;
  let overdueAmount = ZERO;
  let overdueInstallmentCount = 0;
  let oldestOverdueDueDate: Date | null = null;
  let nextDueDate: Date | null = null;
  let nextDueAmount: Prisma.Decimal | null = null;

  const asOfMs = asOf.getTime();

  for (const row of rows) {
    if (row.status === 'PAID') {
      totalPaid = totalPaid.plus(row.amountPaid);
      continue;
    }

    // Unpaid or partially paid
    const remaining = row.totalDue.minus(row.amountPaid);
    outstandingPrincipal = outstandingPrincipal.plus(
      row.principalComponent.minus(row.principalPaid),
    );
    outstandingTotal = outstandingTotal.plus(remaining);
    totalPaid = totalPaid.plus(row.amountPaid);

    const dueDateMs = row.dueDate.getTime();
    const isOverdue = dueDateMs < asOfMs; // strictly before asOf = overdue

    if (isOverdue) {
      overdueAmount = overdueAmount.plus(remaining);
      overdueInstallmentCount += 1;
      if (oldestOverdueDueDate === null || dueDateMs < oldestOverdueDueDate.getTime()) {
        oldestOverdueDueDate = row.dueDate;
      }
    }

    // nextDue = earliest unsettled installment by due date (overdue or upcoming)
    if (nextDueDate === null || dueDateMs < nextDueDate.getTime()) {
      nextDueDate = row.dueDate;
      nextDueAmount = remaining;
    }
  }

  // daysPastDue = calendar days from oldest overdue due date to asOf
  let daysPastDue = 0;
  if (oldestOverdueDueDate !== null) {
    daysPastDue = Math.floor((asOfMs - oldestOverdueDueDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const allPaid = rows.every((r) => r.status === 'PAID');

  return {
    outstandingPrincipal,
    outstandingTotal,
    totalPaid,
    nextDueDate,
    nextDueAmount,
    overdueAmount,
    overdueInstallmentCount,
    daysPastDue,
    status: allPaid ? 'CLOSED' : 'ACTIVE',
  };
}
