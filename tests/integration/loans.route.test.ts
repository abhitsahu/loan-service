/**
 * Integration tests I1, I2, I3, I6
 * Tests run against the real route handlers (imported directly — no HTTP server needed).
 * Firebase Admin is mocked in setup.ts.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import './setup';
import { TEST_TOKEN, authHeader } from './setup';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

// Truncate in correct FK order before each test
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

// Lazy-import handlers so mocks are set up first
async function getHandlers() {
  const { POST: createLoan } = await import('../../src/app/api/(controller)/loans/route');
  const { GET: getLoan } = await import('../../src/app/api/(controller)/loans/[loanId]/route');
  const { POST: recordPayment } = await import('../../src/app/api/(controller)/loans/[loanId]/payments/route');
  return { createLoan, getLoan, recordPayment };
}

describe('I1 — Full success flow: create → pay → read', () => {
  it('creates a loan, records one EMI payment, and verifies the updated schedule', async () => {
    const { createLoan, getLoan, recordPayment } = await getHandlers();

    // Create loan
    const createRes = await createLoan(
      makeReq('http://localhost/api/loans', {
        method: 'POST',
        body: { principal: '200000.00', annualInterestRate: '18', tenureMonths: 24, disbursementDate: '2025-09-01' },
        headers: authHeader(),
      }),
    );
    const createBody = await createRes.json();
    expect(createRes.status).toBe(201);
    expect(createBody.success).toBe(true);
    const loanId = createBody.data.id;

    // Verify schedule was persisted with 24 rows
    const count = await prisma.installment.count({ where: { loanId } });
    expect(count).toBe(24);

    // Record one EMI payment
    const payRes = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, {
        method: 'POST',
        body: { amount: '9985.99', paymentDate: '2025-10-01' },
        headers: { ...authHeader(), 'Idempotency-Key': 'test-key-001' },
      }),
      { params: { loanId } },
    );
    const payBody = await payRes.json();
    expect(payRes.status).toBe(201);
    expect(payBody.success).toBe(true);

    // Verify installment 1 is PAID
    const inst1 = await prisma.installment.findFirst({ where: { loanId, installmentNumber: 1 } });
    expect(inst1?.status).toBe('PAID');

    // GET loan and verify position
    const getRes = await getLoan(
      makeReq(`http://localhost/api/loans/${loanId}?asOf=2025-10-12`, { headers: authHeader() }),
      { params: { loanId } },
    );
    const getBody = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getBody.data.position.overdueAmount).toBe('0.00');
    expect(getBody.data.position.outstandingPrincipal).toBe('193014.01');
  });
});

describe('I2 — Validation failure: negative amount', () => {
  it('returns 422 with VALIDATION_ERROR and details for a negative amount', async () => {
    const { createLoan, recordPayment } = await getHandlers();

    // First create a loan
    const createRes = await createLoan(
      makeReq('http://localhost/api/loans', {
        method: 'POST',
        body: { principal: '200000.00', annualInterestRate: '18', tenureMonths: 24, disbursementDate: '2025-09-01' },
        headers: authHeader(),
      }),
    );
    const { data: { id: loanId } } = await createRes.json();

    const payRes = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, {
        method: 'POST',
        body: { amount: '-100.00', paymentDate: '2025-10-01' },
        headers: authHeader(),
      }),
      { params: { loanId } },
    );

    const body = await payRes.json();
    expect(payRes.status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.length).toBeGreaterThan(0);

    const paymentCount = await prisma.payment.count({ where: { loanId } });
    expect(paymentCount).toBe(0);
  });
});

describe('I3 — Auth: no Authorization header returns 401, zero DB queries', () => {
  it('rejects unauthenticated requests to all three routes', async () => {
    const { createLoan, getLoan, recordPayment } = await getHandlers();
    const fakeId = '00000000-0000-0000-0000-000000000001';

    const r1 = await createLoan(makeReq('http://localhost/api/loans', { method: 'POST', body: {} }));
    expect(r1.status).toBe(401);
    expect((await r1.json()).error.code).toBe('UNAUTHENTICATED');

    const r2 = await getLoan(
      makeReq(`http://localhost/api/loans/${fakeId}`),
      { params: { loanId: fakeId } },
    );
    expect(r2.status).toBe(401);

    const r3 = await recordPayment(
      makeReq(`http://localhost/api/loans/${fakeId}/payments`, { method: 'POST', body: {} }),
      { params: { loanId: fakeId } },
    );
    expect(r3.status).toBe(401);
  });
});

describe('I6 — Unknown loan ID returns 404', () => {
  it('returns 404 LOAN_NOT_FOUND for a valid UUID that does not exist', async () => {
    const { getLoan } = await getHandlers();
    const fakeId = '00000000-0000-0000-0000-000000000099';
    const res = await getLoan(
      makeReq(`http://localhost/api/loans/${fakeId}`, { headers: authHeader() }),
      { params: { loanId: fakeId } },
    );
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('LOAN_NOT_FOUND');
  });
});
