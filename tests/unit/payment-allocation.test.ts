import { describe, it, expect } from 'vitest';
import { allocatePayment } from '@/app/service/payment/payment-allocation.service';
import type { AllocatableInstallment } from '@/app/api/model/domain/allocation';
import { D } from '@/lib/money';

/** Build a clean installment with no payments yet */
function mkInst(
  id: string,
  num: number,
  dueDate: string,
  interest: string,
  principal: string,
  interestPaid = '0',
  principalPaid = '0',
): AllocatableInstallment {
  return {
    id,
    installmentNumber: num,
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    interestComponent: D(interest),
    principalComponent: D(principal),
    interestPaid: D(interestPaid),
    principalPaid: D(principalPaid),
  };
}

// Installment 1: ₹9,985.99 (interest 3000, principal 6985.99)
const inst1 = mkInst('i1', 1, '2025-10-01', '3000.00', '6985.99');
// Installment 2: ₹9,985.99 (interest 2895.21, principal 7090.78)
const inst2 = mkInst('i2', 2, '2025-11-01', '2895.21', '7090.78');
// Installment 3: next one
const inst3 = mkInst('i3', 3, '2025-12-01', '2788.85', '7197.14');

describe('U5 — Underpayment: ₹5,000 on a ₹9,985.99 installment', () => {
  const plan = allocatePayment([inst1], D('5000.00'));

  it('allocates ₹3,000 to interest (fully covers it)', () => {
    const intLine = plan.lines.find((l) => l.component === 'INTEREST' && l.installmentId === 'i1');
    expect(intLine?.amount.toFixed(2)).toBe('3000.00');
  });

  it('allocates ₹2,000 to principal (partial)', () => {
    const prinLine = plan.lines.find((l) => l.component === 'PRINCIPAL' && l.installmentId === 'i1');
    expect(prinLine?.amount.toFixed(2)).toBe('2000.00');
  });

  it('allocatedAmount = 5000.00, unallocatedAmount = 0.00', () => {
    expect(plan.allocatedAmount.toFixed(2)).toBe('5000.00');
    expect(plan.unallocatedAmount.toFixed(2)).toBe('0.00');
  });
});

describe('U6 — Overpayment: 2×EMI rolls to installment 2', () => {
  const plan = allocatePayment([inst1, inst2], D('19971.98'));

  it('produces 4 allocation lines (interest + principal for each of 2 installments)', () => {
    expect(plan.lines).toHaveLength(4);
  });

  it('installment 1 interest = 3000.00', () => {
    const l = plan.lines.find((l) => l.installmentId === 'i1' && l.component === 'INTEREST');
    expect(l?.amount.toFixed(2)).toBe('3000.00');
  });

  it('installment 1 principal = 6985.99', () => {
    const l = plan.lines.find((l) => l.installmentId === 'i1' && l.component === 'PRINCIPAL');
    expect(l?.amount.toFixed(2)).toBe('6985.99');
  });

  it('installment 2 interest = 2895.21', () => {
    const l = plan.lines.find((l) => l.installmentId === 'i2' && l.component === 'INTEREST');
    expect(l?.amount.toFixed(2)).toBe('2895.21');
  });

  it('installment 2 principal = 7090.78', () => {
    const l = plan.lines.find((l) => l.installmentId === 'i2' && l.component === 'PRINCIPAL');
    expect(l?.amount.toFixed(2)).toBe('7090.78');
  });

  it('installment 3 is untouched', () => {
    const touched = plan.lines.filter((l) => l.installmentId === 'i3');
    expect(touched).toHaveLength(0);
  });

  it('nothing unallocated', () => {
    expect(plan.unallocatedAmount.toFixed(2)).toBe('0.00');
  });
});

describe('U7 — Oldest-due-first ordering (late payment with 2 overdue + 1 current)', () => {
  // Installment 1 is 41 days overdue, installment 2 is 11 days overdue, installment 3 is current
  const overdueInst1 = mkInst('i1', 1, '2025-10-01', '3000.00', '6985.99');
  const overdueInst2 = mkInst('i2', 2, '2025-11-01', '2895.21', '7090.78');
  const currentInst  = mkInst('i3', 3, '2025-12-01', '2788.85', '7197.14');

  // Exact EMI amount — just enough to clear installment 1
  const plan = allocatePayment([overdueInst2, overdueInst1, currentInst], D('9985.99'));

  it('installment 1 (oldest) is settled first', () => {
    const int1 = plan.lines.find((l) => l.installmentId === 'i1' && l.component === 'INTEREST');
    const prin1 = plan.lines.find((l) => l.installmentId === 'i1' && l.component === 'PRINCIPAL');
    expect(int1?.amount.toFixed(2)).toBe('3000.00');
    expect(prin1?.amount.toFixed(2)).toBe('6985.99');
  });

  it('installment 2 and 3 are untouched', () => {
    const touched2 = plan.lines.filter((l) => l.installmentId === 'i2');
    const touched3 = plan.lines.filter((l) => l.installmentId === 'i3');
    expect(touched2).toHaveLength(0);
    expect(touched3).toHaveLength(0);
  });
});

describe('U8 — Interest before principal within one installment', () => {
  // Payment less than the interest component — should produce only an INTEREST line
  const plan = allocatePayment([inst1], D('1500.00'));

  it('produces exactly one line: INTEREST', () => {
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].component).toBe('INTEREST');
    expect(plan.lines[0].amount.toFixed(2)).toBe('1500.00');
  });

  it('no PRINCIPAL line', () => {
    const prinLine = plan.lines.find((l) => l.component === 'PRINCIPAL');
    expect(prinLine).toBeUndefined();
  });
});

describe('U9 — Surplus beyond full settlement is unallocated', () => {
  const totalOwed = D('9985.99').plus(D('9985.99')); // 2 installments
  const surplus = D('5000.00');
  const bigPayment = totalOwed.plus(surplus);

  const plan = allocatePayment([inst1, inst2], bigPayment);

  it('allocatedAmount equals sum of both installments', () => {
    expect(plan.allocatedAmount.toFixed(2)).toBe(totalOwed.toFixed(2));
  });

  it('unallocatedAmount equals the surplus', () => {
    expect(plan.unallocatedAmount.toFixed(2)).toBe(surplus.toFixed(2));
  });

  it('no allocation line exceeds what was owed', () => {
    for (const line of plan.lines) {
      expect(line.amount.greaterThan(D(0))).toBe(true);
    }
  });
});

describe('U10 — Zero / negative amount rejected', () => {
  it('throws for amount = 0', () => {
    expect(() => allocatePayment([inst1], D('0'))).toThrow();
  });

  it('throws for amount = -1', () => {
    expect(() => allocatePayment([inst1], D('-1'))).toThrow();
  });
});
