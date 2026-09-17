import { Prisma } from '@prisma/client';
import { ZERO, minD } from '@/lib/money';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';
import { AllocationComponentEnum } from '@/app/api/model/enums/allocation-component';
import type { AllocatableInstallment, AllocationLine, AllocationPlan } from '@/app/api/model/domain/allocation';

export type { AllocatableInstallment, AllocationLine, AllocationPlan };

/** Allocates payment amount: oldest-due-first, interest before principal. */
export function allocatePayment(
  openInstallments: AllocatableInstallment[],
  amount: Prisma.Decimal,
): AllocationPlan {
  if (amount.lessThanOrEqualTo(ZERO)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, 'Payment amount must be greater than 0');
  }

  const targets = [...openInstallments].sort((a, b) => {
    const d = a.dueDate.getTime() - b.dueDate.getTime();
    return d !== 0 ? d : a.installmentNumber - b.installmentNumber;
  });

  let remaining = amount;
  const lines: AllocationLine[] = [];

  for (const inst of targets) {
    if (remaining.isZero()) break;

    const interestOwed = inst.interestComponent.minus(inst.interestPaid);
    if (interestOwed.greaterThan(ZERO)) {
      const pay = minD(remaining, interestOwed);
      lines.push({ installmentId: inst.id, installmentNumber: inst.installmentNumber, component: AllocationComponentEnum.INTEREST, amount: pay });
      remaining = remaining.minus(pay);
    }

    if (remaining.isZero()) continue;

    const principalOwed = inst.principalComponent.minus(inst.principalPaid);
    if (principalOwed.greaterThan(ZERO)) {
      const pay = minD(remaining, principalOwed);
      lines.push({ installmentId: inst.id, installmentNumber: inst.installmentNumber, component: AllocationComponentEnum.PRINCIPAL, amount: pay });
      remaining = remaining.minus(pay);
    }
  }

  return {
    lines,
    allocatedAmount: amount.minus(remaining),
    unallocatedAmount: remaining,
  };
}
