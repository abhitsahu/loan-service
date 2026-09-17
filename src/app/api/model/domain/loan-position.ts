import { Prisma } from '@prisma/client';
import { LoanStatusEnum } from '@/app/api/model/enums/loan-status';

export interface LoanPosition {
  outstandingPrincipal: Prisma.Decimal;
  outstandingTotal: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  nextDueDate: Date | null;
  nextDueAmount: Prisma.Decimal | null;
  overdueAmount: Prisma.Decimal;
  overdueInstallmentCount: number;
  daysPastDue: number;
  status: LoanStatusEnum;
}
