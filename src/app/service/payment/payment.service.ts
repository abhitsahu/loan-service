import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from '@/app/_lib/prisma';
import { D, toApi } from '@/lib/money';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';
import { InstallmentStatusEnum } from '@/app/api/model/enums/installment-status';
import { LoanStatusEnum } from '@/app/api/model/enums/loan-status';
import type { InstallmentRow } from '@/app/api/model/domain/installment-row';
import type { RecordPaymentRequest } from '@/app/api/model/request/record-payment.request';
import type { RecordPaymentResponse } from '@/app/api/model/response/payment.response';
import { allocatePayment } from '@/app/service/payment/payment-allocation.service';
import { computePosition, toInstallmentRow } from '@/app/service/loan/loan-position.service';
import { AllocationComponentEnum } from '@/app/api/model/enums/allocation-component';

function deriveIdempotencyKey(
  loanId: string,
  amount: string,
  paymentDate: string,
  reference?: string,
): string {
  return createHash('sha256')
    .update([loanId, amount, paymentDate, reference ?? ''].join('|'))
    .digest('hex');
}

export async function recordPayment(
  loanId: string,
  req: RecordPaymentRequest,
): Promise<RecordPaymentResponse> {
  const amount = D(req.amount);
  const paymentDate = new Date(`${req.paymentDate}T00:00:00.000Z`);
  const idempotencyKey =
    req.idempotencyKey ??
    deriveIdempotencyKey(loanId, req.amount, req.paymentDate, req.reference);

  return prisma.$transaction(
    async (tx) => {
      let payment: Prisma.PaymentGetPayload<Record<string, never>>;
      let isDuplicate = false;

      try {
        payment = await tx.payment.create({
          data: { loanId, amount, paymentDate, idempotencyKey, allocatedAmount: D(0), unallocatedAmount: amount },
        });
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === 'P2002') {
            isDuplicate = true;
            payment = null as unknown as Prisma.PaymentGetPayload<Record<string, never>>;
          } else if (err.code === 'P2003') {
            throw new AppError(ErrorCode.LOAN_NOT_FOUND, 404);
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      if (isDuplicate) {
        const original = await tx.payment.findUnique({
          where: { loanId_idempotencyKey: { loanId, idempotencyKey } },
          include: {
            allocations: { include: { installment: { select: { installmentNumber: true } } } },
          },
        });
        if (!original) throw new AppError(ErrorCode.INTERNAL_ERROR, 500);

        const allInst = await tx.installment.findMany({ where: { loanId }, orderBy: { installmentNumber: 'asc' } });
        const pos = computePosition(allInst.map(toInstallmentRow), new Date());

        return buildResponse(original, original.allocations, toPositionSummary(pos));
      }

      const loan = await tx.loan.findUnique({ where: { id: loanId } });
      if (!loan) throw new AppError(ErrorCode.LOAN_NOT_FOUND, 404);
      if (loan.status === LoanStatusEnum.CLOSED) throw new AppError(ErrorCode.LOAN_ALREADY_CLOSED, 409);

      const openInstallments = await tx.installment.findMany({
        where: { loanId, status: { not: InstallmentStatusEnum.PAID } },
        orderBy: { installmentNumber: 'asc' },
      });

      const plan = allocatePayment(
        openInstallments.map((i) => ({
          id: i.id,
          installmentNumber: i.installmentNumber,
          dueDate: i.dueDate,
          interestComponent: i.interestComponent,
          principalComponent: i.principalComponent,
          interestPaid: i.interestPaid,
          principalPaid: i.principalPaid,
        })),
        amount,
      );

      if (plan.lines.length > 0) {
        await tx.paymentAllocation.createMany({
          data: plan.lines.map((l) => ({
            paymentId: payment.id,
            installmentId: l.installmentId,
            component: l.component,
            amount: l.amount,
          })),
        });
      }

      for (const inst of openInstallments) {
        const instLines = plan.lines.filter((l) => l.installmentId === inst.id);
        if (instLines.length === 0) continue;

        const newInterestPaid   = inst.interestPaid.plus(instLines.find((l) => l.component === AllocationComponentEnum.INTEREST)?.amount   ?? D(0));
        const newPrincipalPaid  = inst.principalPaid.plus(instLines.find((l) => l.component === AllocationComponentEnum.PRINCIPAL)?.amount  ?? D(0));
        const newAmountPaid = newInterestPaid.plus(newPrincipalPaid);

        const isFullyPaid = newAmountPaid.equals(inst.totalDue);
        const newStatus: InstallmentStatusEnum = isFullyPaid
          ? InstallmentStatusEnum.PAID
          : newAmountPaid.greaterThan(D(0))
          ? InstallmentStatusEnum.PARTIALLY_PAID
          : InstallmentStatusEnum.PENDING;

        await tx.installment.update({
          where: { id: inst.id },
          data: {
            interestPaid: newInterestPaid,
            principalPaid: newPrincipalPaid,
            amountPaid: newAmountPaid,
            status: newStatus,
            settledOn: isFullyPaid ? paymentDate : null,
          },
        });
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { allocatedAmount: plan.allocatedAmount, unallocatedAmount: plan.unallocatedAmount },
      });

      const stillOpen = await tx.installment.count({ where: { loanId, status: { not: InstallmentStatusEnum.PAID } } });
      if (stillOpen === 0) {
        await tx.loan.update({ where: { id: loanId }, data: { status: LoanStatusEnum.CLOSED } });
      }

      const allInst = await tx.installment.findMany({ where: { loanId }, orderBy: { installmentNumber: 'asc' } });
      const pos = computePosition(allInst.map(toInstallmentRow), new Date());

      const savedAllocations = await tx.paymentAllocation.findMany({
        where: { paymentId: payment.id },
        include: { installment: { select: { installmentNumber: true } } },
        orderBy: [{ installment: { installmentNumber: 'asc' } }],
      });

      return buildResponse(
        { ...payment, allocatedAmount: plan.allocatedAmount, unallocatedAmount: plan.unallocatedAmount },
        savedAllocations,
        toPositionSummary(pos),
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function toPositionSummary(pos: ReturnType<typeof computePosition>): RecordPaymentResponse['position'] {
  return {
    outstandingPrincipal: toApi(pos.outstandingPrincipal),
    nextDueDate: pos.nextDueDate ? pos.nextDueDate.toISOString().slice(0, 10) : null,
    nextDueAmount: pos.nextDueAmount ? toApi(pos.nextDueAmount) : null,
    overdueAmount: toApi(pos.overdueAmount),
    daysPastDue: pos.daysPastDue,
  };
}

function buildResponse(
  payment: { id: string; loanId: string; amount: Prisma.Decimal; paymentDate: Date; allocatedAmount: Prisma.Decimal; unallocatedAmount: Prisma.Decimal },
  allocations: Array<{ component: string; amount: Prisma.Decimal; installment: { installmentNumber: number } }>,
  position: RecordPaymentResponse['position'],
): RecordPaymentResponse {
  return {
    payment: {
      id: payment.id,
      loanId: payment.loanId,
      amount: toApi(payment.amount),
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      allocatedAmount: toApi(payment.allocatedAmount),
      unallocatedAmount: toApi(payment.unallocatedAmount),
    },
    allocations: allocations.map((a) => ({
      installmentNumber: a.installment.installmentNumber,
      component: a.component,
      amount: toApi(a.amount),
    })),
    position,
  };
}
