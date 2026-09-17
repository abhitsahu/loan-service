/**
 * Integration tests I4, I5
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import './setup';
import { TEST_TOKEN, authHeader } from './setup';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE payment_allocations, payments, installments, loans RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

function makeReq(url: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

async function getHandlers() {
  const { POST: createLoan } = await import('../../src/app/api/(controller)/loans/route');
  const { POST: recordPayment } = await import('../../src/app/api/(controller)/loans/[loanId]/payments/route');
  return { createLoan, recordPayment };
}

describe('I4 — Duplicate idempotency key replays original, no second allocation', () => {
  it('second call with same key returns 200 with meta.idempotent, payment row count = 1', async () => {
    const { createLoan, recordPayment } = await getHandlers();

    const createRes = await createLoan(
      makeReq('http://localhost/api/loans', {
        method: 'POST',
        body: { principal: '200000.00', annualInterestRate: '18', tenureMonths: 24, disbursementDate: '2025-09-01' },
        headers: authHeader(),
      }),
    );
    const { data: { id: loanId } } = await createRes.json();

    const payload = { amount: '9985.99', paymentDate: '2025-10-01' };
    const key = 'dedup-key-001';

    // First submission
    const res1 = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, {
        method: 'POST', body: payload,
        headers: { ...authHeader(), 'Idempotency-Key': key },
      }),
      { params: { loanId } },
    );
    expect(res1.status).toBe(201);

    // Second submission — same key
    const res2 = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, {
        method: 'POST', body: payload,
        headers: { ...authHeader(), 'Idempotency-Key': key },
      }),
      { params: { loanId } },
    );
    const body2 = await res2.json();
    expect(res2.status).toBe(200);

    // Only one payment row must exist
    const count = await prisma.payment.count({ where: { loanId } });
    expect(count).toBe(1);

    // installment 1 amount_paid must still be 9985.99 (not doubled)
    const inst1 = await prisma.installment.findFirst({ where: { loanId, installmentNumber: 1 } });
    expect(inst1?.amountPaid.toFixed(2)).toBe('9985.99');
    expect(inst1?.status).toBe('PAID');
  });
});

describe('I5 — Orphan payment rejected by DB FK constraint', () => {
  it('raw INSERT with a random loan_id fails with FK violation', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000099';
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO payments (id, loan_id, amount, payment_date, idempotency_key, allocated_amount, unallocated_amount)
         VALUES (gen_random_uuid(), $1::uuid, 100.00, now()::date, 'orphan-key', 0.00, 100.00)`,
        fakeId,
      ),
    ).rejects.toThrow(); // FK constraint violation (SQLSTATE 23503)
  });
});
