import { describe, it, expect } from 'vitest';
import { computePosition, InstallmentRow } from '../../src/app/service/loan/loan-position.service';
import { D } from '../../src/lib/money';

function mkRow(
  id: string,
  num: number,
  dueDate: string,
  interest: string,
  principal: string,
  interestPaid = '0',
  principalPaid = '0',
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' = 'PENDING',
): InstallmentRow {
  const ip = D(interestPaid);
  const pp = D(principalPaid);
  const totalDue = D(interest).plus(D(principal));
  const amountPaid = ip.plus(pp);
  return {
    id,
    installmentNumber: num,
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    interestComponent: D(interest),
    principalComponent: D(principal),
    interestPaid: ip,
    principalPaid: pp,
    totalDue,
    amountPaid,
    status,
  };
}

describe('U11 — Overdue and days past due computed from asOf', () => {
  // asOf = 2025-11-12
  // Installment 1 due 2025-10-01 = 41 days overdue, amount = 9985.99
  // Installment 2 due 2025-11-01 = 11 days overdue, amount = 9985.99
  // Installment 3 due 2025-12-01 = future
  const rows: InstallmentRow[] = [
    mkRow('i1', 1, '2025-10-01', '3000.00', '6985.99'),
    mkRow('i2', 2, '2025-11-01', '2895.21', '7090.78'),
    mkRow('i3', 3, '2025-12-01', '2788.85', '7197.14'),
  ];

  const asOf = new Date('2025-11-12T00:00:00.000Z');
  const pos = computePosition(rows, asOf);

  it('overdueAmount = sum of the two overdue installments', () => {
    const expected = D('9985.99').plus(D('9985.99'));
    expect(pos.overdueAmount.toFixed(2)).toBe(expected.toFixed(2));
  });

  it('overdueInstallmentCount = 2', () => {
    expect(pos.overdueInstallmentCount).toBe(2);
  });

  it('daysPastDue = 42 (oldest overdue, Oct 1 → Nov 12)', () => {
    expect(pos.daysPastDue).toBe(42);
  });

  it('status = ACTIVE', () => {
    expect(pos.status).toBe('ACTIVE');
  });
});

describe('U12 — Position after a partial payment', () => {
  // Installment 1 partially paid: ₹5,000 paid (interest 3000 + 2000 principal)
  // asOf = 2025-10-12 (11 days past installment 1 due date)
  const rows: InstallmentRow[] = [
    mkRow('i1', 1, '2025-10-01', '3000.00', '6985.99', '3000.00', '2000.00', 'PARTIALLY_PAID'),
    mkRow('i2', 2, '2025-11-01', '2895.21', '7090.78'),
    mkRow('i3', 3, '2025-12-01', '2788.85', '7197.14'),
  ];

  const asOf = new Date('2025-10-12T00:00:00.000Z');
  const pos = computePosition(rows, asOf);

  it('nextDueAmount = remaining on installment 1 (4985.99), not its totalDue', () => {
    // nextDue is the overdue installment since it's still unpaid and past due
    expect(pos.nextDueAmount?.toFixed(2)).toBe('4985.99');
  });

  it('outstandingPrincipal = original - principalPaid on inst 1', () => {
    // inst1 remaining principal: 6985.99 - 2000 = 4985.99
    // inst2 principal: 7090.78
    // inst3 principal: 7197.14
    const expected = D('4985.99').plus(D('7090.78')).plus(D('7197.14'));
    expect(pos.outstandingPrincipal.toFixed(2)).toBe(expected.toFixed(2));
  });

  it('totalPaid = 5000.00', () => {
    expect(pos.totalPaid.toFixed(2)).toBe('5000.00');
  });

  it('status = ACTIVE', () => {
    expect(pos.status).toBe('ACTIVE');
  });
});

describe('Closed loan', () => {
  const rows: InstallmentRow[] = [
    mkRow('i1', 1, '2025-10-01', '3000.00', '6985.99', '3000.00', '6985.99', 'PAID'),
    mkRow('i2', 2, '2025-11-01', '2895.21', '7090.78', '2895.21', '7090.78', 'PAID'),
  ];

  const pos = computePosition(rows, new Date('2025-11-15T00:00:00.000Z'));

  it('status = CLOSED when all installments are PAID', () => {
    expect(pos.status).toBe('CLOSED');
  });

  it('outstandingPrincipal = 0', () => {
    expect(pos.outstandingPrincipal.toFixed(2)).toBe('0.00');
  });
});
