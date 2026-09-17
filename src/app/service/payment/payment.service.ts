import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from '@/app/_lib/prisma';
import { D, toApi } from '@/lib/money';
import { allocatePayment } from './payment-allocation.service';
import { computePosition } from '@/app/service/loan/loan-position.service';
import { RecordPaymentRequest } from '@/app/api/model/request/record-payment.request';
import { RecordPaymentResponse } from '@/app/api/model/response/payment.response';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';
import type { InstallmentRow } from '@/app/service/loan/loan-position.service';

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

  try {
    return await prisma.$transaction(
      async (tx) => {
        // ① Insert payment row — races on idempotency key resolved here (UNIQUE constraint)
        let payment: Prisma.PaymentGetPayload<{}>;
        let isDuplicate = false;

        try {
          payment = await tx.payment.create({
            data: {
              loanId,
              amount,
              paymentDate,
              idempotencyKey,
              allocatedAmount: D(0),
              unallocatedAmount: amount,
            },
          });
        } catch (err: unknown) {
          // SQLSTATE 23505 = unique_violation (duplicate idempotency key)
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            isDuplicate = true;
            // Fall through — handled below after the try/catch
            payment = null as unknown as Prisma.PaymentGetPayload<{}>;
          } else if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2003'
          ) {
            // FK violation: loan_id does not exist
            throw new AppError(ErrorCode.LOAN_NOT_FOUND, 404);
          } else {
            throw err;
          }
        }

        if (isDuplicate) {
          // Replay the original result — safe for retrying clients
          const original = await tx.payment.findUnique({
            where: { loanId_idempotencyKey: { loanId, idempotencyKey } },
            include: {
              allocations: {
                include: { installment: { select: { installmentNumber: true } } },
              },
            },
          });

          if (!original) throw new AppError(ErrorCode.INTERNAL_ERROR, 500);

          const loan = await tx.loan.findUnique({ where: { id: loanId } });
          const openInst = await tx.installment.findMany({
            where: { loanId },
            orderBy: { installmentNumber: 'asc' },
          });
          const positionRows: InstallmentRow[] = openInst.map((i) => ({
            id: i.id,
            installmentNumber: i.installmentNumber,
            dueDate: i.dueDate,
            principalComponent: i.principalComponent,
            interestComponent: i.interestComponent,
            totalDue: i.totalDue,
            principalPaid: i.principalPaid,
            interestPaid: i.interestPaid,
            amountPaid: i.amountPaid,
            status: i.status,
          }));
          const pos = computePosition(positionRows, new Date());

          return {
            payment: {
              id: original.id,
              loanId: original.loanId,
              amount: toApi(original.amount),
              paymentDate: original.paymentDate.toISOString().slice(0, 10),
              allocatedAmount: toApi(original.allocatedAmount),
              unallocatedAmount: toApi(original.unallocatedAmount),
            },
            allocations: original.allocations.map((a) => ({
              installmentNumber: a.installment.installmentNumber,
              component: a.component,
              amount: toApi(a.amount),
            })),
            position: {
              outstandingPrincipal: toApi(pos.outstandingPrincipal),
              nextDueDate: pos.nextDueDate ? pos.nextDueDate.toISOString().slice(0, 10) : null,
              nextDueAmount: pos.nextDueAmount ? toApi(pos.nextDueAmount) : null,
              overdueAmount: toApi(pos.overdueAmount),
              daysPastDue: pos.daysPastDue,
            },
            // Note: meta.idempotent = true is added by the route handler
          };
        }

        // ② Lock the loan row to serialise concurrent payments
        const loan = await tx.loan.findUnique({ where: { id: loanId } });
        if (!loan) throw new AppError(ErrorCode.LOAN_NOT_FOUND, 404);
        if (loan.status === 'CLOSED') throw new AppError(ErrorCode.LOAN_ALREADY_CLOSED, 409);

        // ③ Load open installments
        const openInstallments = await tx.installment.findMany({
          where: { loanId, status: { not: 'PAID' } },
          orderBy: { installmentNumber: 'asc' },
        });

        // ④ Pure allocation — no DB
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

        // ⑤ Insert payment_allocations
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

        // ⑥ Update each touched installment's running totals
        for (const inst of openInstallments) {
          const instLines = plan.lines.filter((l) => l.installmentId === inst.id);
          if (instLines.length === 0) continue;

          const interestLine = instLines.find((l) => l.component === 'INTEREST');
          const principalLine = instLines.find((l) => l.component === 'PRINCIPAL');

          const newInterestPaid = inst.interestPaid.plus(interestLine?.amount ?? D(0));
          const newPrincipalPaid = inst.principalPaid.plus(principalLine?.amount ?? D(0));
          const newAmountPaid = newInterestPaid.plus(newPrincipalPaid);

          const isFullyPaid = newAmountPaid.equals(inst.totalDue);
          const newStatus = isFullyPaid
            ? 'PAID'
            : newAmountPaid.greaterThan(D(0))
            ? 'PARTIALLY_PAID'
            : 'PENDING';

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

        // ⑦ Update payment's allocated/unallocated split
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            allocatedAmount: plan.allocatedAmount,
            unallocatedAmount: plan.unallocatedAmount,
          },
        });

        // ⑧ Close the loan if all installments are now paid
        const remainingOpen = await tx.installment.count({
          where: { loanId, status: { not: 'PAID' } },
        });
        if (remainingOpen === 0) {
          await tx.loan.update({ where: { id: loanId }, data: { status: 'CLOSED' } });
        }

        // Build position from refreshed state
        const allInst = await tx.installment.findMany({
          where: { loanId },
          orderBy: { installmentNumber: 'asc' },
        });
        const positionRows: InstallmentRow[] = allInst.map((i) => ({
          id: i.id,
          installmentNumber: i.installmentNumber,
          dueDate: i.dueDate,
          principalComponent: i.principalComponent,
          interestComponent: i.interestComponent,
          totalDue: i.totalDue,
          principalPaid: i.principalPaid,
          interestPaid: i.interestPaid,
          amountPaid: i.amountPaid,
          status: i.status,
        }));
        const pos = computePosition(positionRows, new Date());

        // Fetch allocations with installment numbers for response
        const savedAllocations = await tx.paymentAllocation.findMany({
          where: { paymentId: payment.id },
          include: { installment: { select: { installmentNumber: true } } },
          orderBy: [{ installment: { installmentNumber: 'asc' } }],
        });

        return {
          payment: {
            id: payment.id,
            loanId: payment.loanId,
            amount: toApi(payment.amount),
            paymentDate: payment.paymentDate.toISOString().slice(0, 10),
            allocatedAmount: toApi(plan.allocatedAmount),
            unallocatedAmount: toApi(plan.unallocatedAmount),
          },
          allocations: savedAllocations.map((a) => ({
            installmentNumber: a.installment.installmentNumber,
            component: a.component,
            amount: toApi(a.amount),
          })),
          position: {
            outstandingPrincipal: toApi(pos.outstandingPrincipal),
            nextDueDate: pos.nextDueDate ? pos.nextDueDate.toISOString().slice(0, 10) : null,
            nextDueAmount: pos.nextDueAmount ? toApi(pos.nextDueAmount) : null,
            overdueAmount: toApi(pos.overdueAmount),
            daysPastDue: pos.daysPastDue,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    // Re-throw AppError as-is; Prisma / unknown errors become 500
    if (err instanceof AppError) throw err;
    throw err;
  }
}
