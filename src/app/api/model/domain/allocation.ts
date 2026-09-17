import { Prisma } from '@prisma/client';
import { AllocationComponentEnum } from '@/app/api/model/enums/allocation-component';

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
  component: AllocationComponentEnum;
  amount: Prisma.Decimal;
}

export interface AllocationPlan {
  lines: AllocationLine[];
  allocatedAmount: Prisma.Decimal;
  unallocatedAmount: Prisma.Decimal;
}
