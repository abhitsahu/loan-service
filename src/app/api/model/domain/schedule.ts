import { Prisma } from '@prisma/client';

export interface ScheduleInput {
  principal: Prisma.Decimal;
  annualInterestRate: Prisma.Decimal;
  tenureMonths: number;
  disbursementDate: Date;
}

export interface ScheduleRow {
  installmentNumber: number;
  dueDate: Date;
  openingBalance: Prisma.Decimal;
  principalComponent: Prisma.Decimal;
  interestComponent: Prisma.Decimal;
  totalDue: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
}

export interface GeneratedSchedule {
  emiAmount: Prisma.Decimal;
  totalInterest: Prisma.Decimal;
  totalPayable: Prisma.Decimal;
  rows: ScheduleRow[];
}
