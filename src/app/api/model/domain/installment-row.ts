import { Prisma } from '@prisma/client';
import { InstallmentStatusEnum } from '@/app/api/model/enums/installment-status';

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
  status: InstallmentStatusEnum;
}
