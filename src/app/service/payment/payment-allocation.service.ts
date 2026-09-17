import { Prisma } from '@prisma/client';
import { D, minD, ZERO } from '@/lib/money';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';

export interface AllocatableInstallment {
  id: string;
  installmentNumber: number;
  dueDate: Date;
  interestComponent: Prisma.Decimal;
  principalComponent: Prisma.Decimal;
  interestPaid: Prisma.Decimal;
  principalPaid: Prisma.Decimal;
}

export interface AllocationLine {
  installmentId: string;
  installmentNumber: number;
  component: 'INTEREST' | 'PRINCIPAL';
  amount: Prisma.Decimal;
}

export interface AllocationPlan {
  lines: AllocationLine[];
  allocatedAmount: Prisma.Decimal;
  unallocatedAmount: Prisma.Decimal; // > 0 only when the loan is fully settled
}

/**
 * Pure allocation function — no DB access.
 *
 * Allocation order (J4):
 *   - Oldest-due-first across installments (arrears age out rather than accumulate)
 *   - Within each installment: interest before principal (lender's earned income first)
 *   - Surplus cascades to the next unsettled installment in schedule order
 *   - Surplus beyond the full schedule is held as unallocatedAmount (J6)
 *
 * @param openInstallments  Unsettled installments, caller MUST pass ASC by installmentNumber
 * @param amount            Payment amount, must be > 0 with ≤ 2 dp
 */
export function allocatePayment(
  openInstallments: AllocatableInstallment[],
  amount: Prisma.Decimal,
): AllocationPlan {
  if (amount.lessThanOrEqualTo(ZERO)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, 'Payment amount must be greater than 0');
  }

  // Sort oldest-due-first (defensive — callers should pre-sort)
  const targets = [...openInstallments].sort((a, b) => {
    const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
    return dateDiff !== 0 ? dateDiff : a.installmentNumber - b.installmentNumber;
  });

  let remaining = amount;
  const lines: AllocationLine[] = [];

  for (const inst of targets) {
    if (remaining.isZero()) break;

    // --- Interest leg first ---
    const interestOwed = inst.interestComponent.minus(inst.interestPaid);
    if (interestOwed.greaterThan(ZERO)) {
      const payInterest = minD(remaining, interestOwed);
      lines.push({
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        component: 'INTEREST',
        amount: payInterest,
      });
      remaining = remaining.minus(payInterest);
    }

    if (remaining.isZero()) continue;

    // --- Principal leg ---
    const principalOwed = inst.principalComponent.minus(inst.principalPaid);
    if (principalOwed.greaterThan(ZERO)) {
      const payPrincipal = minD(remaining, principalOwed);
      lines.push({
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        component: 'PRINCIPAL',
        amount: payPrincipal,
      });
      remaining = remaining.minus(payPrincipal);
    }
  }

  return {
    lines,
    allocatedAmount: amount.minus(remaining),
    unallocatedAmount: remaining,
  };
}
