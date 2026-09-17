import { prisma } from '@/app/_lib/prisma';
import { D, toApi } from '@/lib/money';
import { generateSchedule } from '@/app/service/loan/schedule-generation.service';
import { CreateLoanRequest } from '@/app/api/model/request/create-loan.request';
import { LoanResponse } from '@/app/api/model/response/loan.response';
import { GetLoanResponse } from '@/app/api/model/response/payment.response';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';
import { InstallmentStatusEnum } from '@/app/api/model/enums/installment-status';
import { computePosition, toInstallmentRow } from '@/app/service/loan/loan-position.service';


export async function createLoan(req: CreateLoanRequest): Promise<LoanResponse> {
  const principal = D(req.principal);
  const annualInterestRate = D(req.annualInterestRate);
  const disbursementDate = new Date(`${req.disbursementDate}T00:00:00.000Z`);

  const { emiAmount, totalInterest, totalPayable, rows } = generateSchedule({
    principal,
    annualInterestRate,
    tenureMonths: req.tenureMonths,
    disbursementDate,
  });

  const loan = await prisma.$transaction(async (tx) => {
    const l = await tx.loan.create({
      data: {
        principal,
        annualInterestRate,
        tenureMonths: req.tenureMonths,
        disbursementDate,
        emiAmount,
        totalInterest,
        totalPayable,
      },
    });

    await tx.installment.createMany({
      data: rows.map((r) => ({
        loanId: l.id,
        installmentNumber: r.installmentNumber,
        dueDate: r.dueDate,
        openingBalance: r.openingBalance,
        principalComponent: r.principalComponent,
        interestComponent: r.interestComponent,
        totalDue: r.totalDue,
        closingBalance: r.closingBalance,
      })),
    });

    return l;
  });

  return {
    id: loan.id,
    principal: toApi(loan.principal),
    annualInterestRate: toApi(loan.annualInterestRate),
    tenureMonths: loan.tenureMonths,
    disbursementDate: loan.disbursementDate.toISOString().slice(0, 10),
    emiAmount: toApi(loan.emiAmount),
    totalInterest: toApi(loan.totalInterest),
    totalPayable: toApi(loan.totalPayable),
    status: loan.status,
    installmentCount: rows.length,
  };
}

export async function getLoan(loanId: string, asOf?: Date): Promise<GetLoanResponse> {
  const asOfDate = asOf ?? new Date();
  const asOfUTC = new Date(
    Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate()),
  );

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      installments: { orderBy: { installmentNumber: 'asc' } },
      payments: { orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }] },
    },
  });

  if (!loan) {
    throw new AppError(ErrorCode.LOAN_NOT_FOUND, 404);
  }

  const asOfMs = asOfUTC.getTime();

  const schedule = loan.installments.map((inst) => {
    const remaining = inst.totalDue.minus(inst.amountPaid);
    const dueDateMs = inst.dueDate.getTime();
    const isOverdue  = inst.status !== InstallmentStatusEnum.PAID && dueDateMs < asOfMs;
    const daysPastDue = isOverdue ? Math.floor((asOfMs - dueDateMs) / 86_400_000) : 0;

    return {
      installmentNumber: inst.installmentNumber,
      dueDate: inst.dueDate.toISOString().slice(0, 10),
      openingBalance: toApi(inst.openingBalance),
      principalComponent: toApi(inst.principalComponent),
      interestComponent: toApi(inst.interestComponent),
      totalDue: toApi(inst.totalDue),
      amountPaid: toApi(inst.amountPaid),
      principalPaid: toApi(inst.principalPaid),
      interestPaid: toApi(inst.interestPaid),
      remainingDue: toApi(remaining),
      closingBalance: toApi(inst.closingBalance),
      status: inst.status as InstallmentStatusEnum,
      settledOn: inst.settledOn ? inst.settledOn.toISOString().slice(0, 10) : null,
      isOverdue,
      daysPastDue,
    };
  });

  const positionRows = loan.installments.map(toInstallmentRow);
  const pos = computePosition(positionRows, asOfUTC);

  return {
    loan: {
      id: loan.id,
      principal: toApi(loan.principal),
      annualInterestRate: toApi(loan.annualInterestRate),
      tenureMonths: loan.tenureMonths,
      disbursementDate: loan.disbursementDate.toISOString().slice(0, 10),
      emiAmount: toApi(loan.emiAmount),
      totalInterest: toApi(loan.totalInterest),
      totalPayable: toApi(loan.totalPayable),
      status: loan.status,
    },
    schedule,
    position: {
      outstandingPrincipal: toApi(pos.outstandingPrincipal),
      outstandingTotal: toApi(pos.outstandingTotal),
      totalPaid: toApi(pos.totalPaid),
      nextDueDate: pos.nextDueDate ? pos.nextDueDate.toISOString().slice(0, 10) : null,
      nextDueAmount: pos.nextDueAmount ? toApi(pos.nextDueAmount) : null,
      overdueAmount: toApi(pos.overdueAmount),
      overdueInstallmentCount: pos.overdueInstallmentCount,
      daysPastDue: pos.daysPastDue,
      asOf: asOfUTC.toISOString().slice(0, 10),
    },
    payments: loan.payments.map((p) => ({
      id: p.id,
      loanId: p.loanId,
      amount: toApi(p.amount),
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      allocatedAmount: toApi(p.allocatedAmount),
      unallocatedAmount: toApi(p.unallocatedAmount),
    })),
  };
}
