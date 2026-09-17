import { ZERO } from '@/lib/money';
import { Prisma } from '@prisma/client';

import { LoanStatusEnum } from '@/app/api/model/enums/loan-status';
import { InstallmentStatusEnum } from '@/app/api/model/enums/installment-status';
import type { InstallmentRow } from '@/app/api/model/domain/installment-row';
import type { LoanPosition } from '@/app/api/model/domain/loan-position';

export type { InstallmentRow, LoanPosition };

export function toInstallmentRow(i: {
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
}): InstallmentRow {
  return { ...i, status: i.status as InstallmentStatusEnum };
}

// Derives loan position from installments and reference date
export function computePosition(rows: InstallmentRow[], asOf: Date): LoanPosition {
  let outstandingPrincipal = ZERO;
  let outstandingTotal = ZERO;
  let totalPaid = ZERO;
  let overdueAmount = ZERO;
  let overdueInstallmentCount = 0;
  let oldestOverdueDueDate: Date | null = null;
  let nextDueDate: Date | null = null;
  let nextDueAmount = null as import('@prisma/client').Prisma.Decimal | null;

  const asOfMs = asOf.getTime();

  for (const row of rows) {
    if (row.status === InstallmentStatusEnum.PAID) {
      totalPaid = totalPaid.plus(row.amountPaid);
      continue;
    }

    const remaining = row.totalDue.minus(row.amountPaid);
    outstandingPrincipal = outstandingPrincipal.plus(row.principalComponent.minus(row.principalPaid));
    outstandingTotal = outstandingTotal.plus(remaining);
    totalPaid = totalPaid.plus(row.amountPaid);

    const dueDateMs = row.dueDate.getTime();
    const isOverdue = dueDateMs < asOfMs;

    if (isOverdue) {
      overdueAmount = overdueAmount.plus(remaining);
      overdueInstallmentCount += 1;
      if (oldestOverdueDueDate === null || dueDateMs < oldestOverdueDueDate.getTime()) {
        oldestOverdueDueDate = row.dueDate;
      }
    }

    if (nextDueDate === null || dueDateMs < nextDueDate.getTime()) {
      nextDueDate = row.dueDate;
      nextDueAmount = remaining;
    }
  }

  const daysPastDue =
    oldestOverdueDueDate !== null
      ? Math.floor((asOfMs - oldestOverdueDueDate.getTime()) / 86_400_000)
      : 0;

  const allPaid = rows.every((r) => r.status === InstallmentStatusEnum.PAID);

  return {
    outstandingPrincipal,
    outstandingTotal,
    totalPaid,
    nextDueDate,
    nextDueAmount,
    overdueAmount,
    overdueInstallmentCount,
    daysPastDue,
    status: allPaid ? LoanStatusEnum.CLOSED : LoanStatusEnum.ACTIVE,
  };
}
