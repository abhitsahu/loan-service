import { describe, it, expect } from 'vitest';
import './setup';
import { makeReq, authHeader, prismaTest, getHandlers, LOAN_BODY } from './setup';

describe('I4 — Duplicate idempotency key replays original, no second allocation', () => {
  it('second call with same key returns 200, payment row count stays 1', async () => {
    const { createLoan, recordPayment } = await getHandlers();

    const { data: { id: loanId } } = await (await createLoan(
      makeReq('http://localhost/api/loans', { method: 'POST', body: LOAN_BODY, headers: authHeader() }),
    )).json();

    const payload = { amount: '9985.99', paymentDate: '2025-10-01' };
    const key     = 'dedup-key-001';
    const hdrs    = { ...authHeader(), 'Idempotency-Key': key };

    const res1 = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, { method: 'POST', body: payload, headers: hdrs }),
      { params: { loanId } },
    );
    expect(res1.status).toBe(201);

    const res2 = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, { method: 'POST', body: payload, headers: hdrs }),
      { params: { loanId } },
    );
    expect(res2.status).toBe(200);

    expect(await prismaTest.payment.count({ where: { loanId } })).toBe(1);

    const inst1 = await prismaTest.installment.findFirst({ where: { loanId, installmentNumber: 1 } });
    expect(inst1?.amountPaid.toFixed(2)).toBe('9985.99');
    expect(inst1?.status).toBe('PAID');
  });
});

describe('I5 — Orphan payment rejected by DB FK constraint', () => {
  it('raw INSERT with a non-existent loan_id throws', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000099';
    await expect(
      prismaTest.$executeRawUnsafe(
        `INSERT INTO payments (id, loan_id, amount, payment_date, idempotency_key, allocated_amount, unallocated_amount)
         VALUES (gen_random_uuid(), $1::uuid, 100.00, now()::date, 'orphan-key', 0.00, 100.00)`,
        fakeId,
      ),
    ).rejects.toThrow();
  });
});
