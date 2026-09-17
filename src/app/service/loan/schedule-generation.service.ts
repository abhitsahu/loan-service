import { Prisma } from '@prisma/client';
import { D, round2, ZERO } from '@/lib/money';

export interface ScheduleInput {
  principal: Prisma.Decimal;
  annualInterestRate: Prisma.Decimal; // percent p.a., e.g. 18
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

/** r = annualRatePct / 12 / 100 */
export function computeMonthlyRate(annualRatePct: Prisma.Decimal): Prisma.Decimal {
  return annualRatePct.div(12).div(100);
}

/**
 * Standard EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
 * Zero-interest edge case: EMI = round2(P / n)
 * Rounded HALF_UP to 2 dp — the only rounding of the EMI.
 */
export function computeEmi(p: Prisma.Decimal, r: Prisma.Decimal, n: number): Prisma.Decimal {
  if (r.isZero()) {
    return round2(p.div(n));
  }
  const one = D(1);
  const f = one.plus(r).pow(n); // high precision, NOT rounded here
  return round2(p.mul(r).mul(f).div(f.minus(one)));
}

/**
 * disbursementDate + k months, day-of-month preserved, clamped to EOM.
 * Stored as UTC midnight DATE — no time zone shift on comparisons.
 */
export function computeDueDate(disbursedOn: Date, k: number): Date {
  const y = disbursedOn.getUTCFullYear();
  const m = disbursedOn.getUTCMonth(); // 0-indexed
  const day = disbursedOn.getUTCDate();

  const rawMonth = m + k;
  const targetYear = y + Math.floor(rawMonth / 12);
  const targetMonth = rawMonth % 12; // 0-indexed

  // Last day of target month
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

/**
 * Builds the full amortisation schedule.
 *
 * Rounding strategy (J2):
 *   - Interest per period = round2(balance × r)  → HALF_UP
 *   - Principal (k < n)   = EMI − interest        → exact, no extra rounding
 *   - Final installment   = exact remaining balance → absorbs all accumulated variance
 *   - Closing balance is therefore exactly 0.00
 */
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
      // Final installment: exact remaining balance clears the loan exactly
      principalComponent = balance;
      totalDue = principalComponent.plus(interestComponent);
    }

    const closingBalance = balance.minus(principalComponent);
    const dueDate = computeDueDate(disbursementDate, k);

    rows.push({
      installmentNumber: k,
      dueDate,
      openingBalance,
      principalComponent,
      interestComponent,
      totalDue,
      closingBalance,
    });

    balance = closingBalance;
  }

  // Derived totals — persisted on loans so the API never recomputes them
  let totalInterest = ZERO;
  for (const row of rows) {
    totalInterest = totalInterest.plus(row.interestComponent);
  }
  totalInterest = round2(totalInterest);
  const totalPayable = round2(principal.plus(totalInterest));

  return { emiAmount: emi, totalInterest, totalPayable, rows };
}
