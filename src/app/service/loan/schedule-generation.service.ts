import { Prisma } from '@prisma/client';
import { D, round2, ZERO } from '@/lib/money';
import type { ScheduleInput, ScheduleRow, GeneratedSchedule } from '@/app/api/model/domain/schedule';

export type { ScheduleInput, ScheduleRow, GeneratedSchedule };

export function computeMonthlyRate(annualRatePct: Prisma.Decimal): Prisma.Decimal {
  return annualRatePct.div(12).div(100);
}

/** Computes EMI rounded HALF_UP to 2 decimal places. */
export function computeEmi(p: Prisma.Decimal, r: Prisma.Decimal, n: number): Prisma.Decimal {
  if (r.isZero()) {
    return round2(p.div(n));
  }
  const f = D(1).plus(r).pow(n);
  return round2(p.mul(r).mul(f).div(f.minus(D(1))));
}

/** Computes due date advancing by k months with end-of-month clamping. */
export function computeDueDate(disbursedOn: Date, k: number): Date {
  const rawMonth = disbursedOn.getUTCMonth() + k;
  const targetYear = disbursedOn.getUTCFullYear() + Math.floor(rawMonth / 12);
  const targetMonth = rawMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(disbursedOn.getUTCDate(), lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

/** Generates amortisation schedule. */
export function generateSchedule(input: ScheduleInput): GeneratedSchedule {
  const { principal, annualInterestRate, tenureMonths, disbursementDate } = input;

  const r = computeMonthlyRate(annualInterestRate);
  const emi = computeEmi(principal, r, tenureMonths);

  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let k = 1; k <= tenureMonths; k++) {
    const openingBalance = balance;
    const interestComponent = round2(balance.mul(r));

    let principalComponent: Prisma.Decimal;
    let totalDue: Prisma.Decimal;

    if (k < tenureMonths) {
      principalComponent = emi.minus(interestComponent);
      totalDue = emi;
    } else {
      principalComponent = balance;
      totalDue = principalComponent.plus(interestComponent);
    }

    const closingBalance = balance.minus(principalComponent);

    rows.push({
      installmentNumber: k,
      dueDate: computeDueDate(disbursementDate, k),
      openingBalance,
      principalComponent,
      interestComponent,
      totalDue,
      closingBalance,
    });

    balance = closingBalance;
  }

  let totalInterest = ZERO;
  for (const row of rows) totalInterest = totalInterest.plus(row.interestComponent);
  totalInterest = round2(totalInterest);

  return { emiAmount: emi, totalInterest, totalPayable: round2(principal.plus(totalInterest)), rows };
}
