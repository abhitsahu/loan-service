import { describe, it, expect } from 'vitest';
import './setup';
import { makeReq, authHeader, prismaTest, getHandlers, LOAN_BODY } from './setup';

describe('I1 — Full success flow: create → pay → read', () => {
  it('creates a loan, records one EMI payment, and verifies the updated schedule', async () => {
    const { createLoan, getLoan, recordPayment } = await getHandlers();

    const createRes  = await createLoan(makeReq('http://localhost/api/loans', { method: 'POST', body: LOAN_BODY, headers: authHeader() }));
    const createBody = await createRes.json();
    expect(createRes.status).toBe(201);
    const loanId: string = createBody.data.id;

    expect(await prismaTest.installment.count({ where: { loanId } })).toBe(24);

    const payRes  = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, {
        method: 'POST',
        body: { amount: '9985.99', paymentDate: '2025-10-01' },
        headers: { ...authHeader(), 'Idempotency-Key': 'test-key-001' },
      }),
      { params: { loanId } },
    );
    expect(payRes.status).toBe(201);
    expect((await payRes.json()).success).toBe(true);

    const inst1 = await prismaTest.installment.findFirst({ where: { loanId, installmentNumber: 1 } });
    expect(inst1?.status).toBe('PAID');

    const getRes  = await getLoan(
      makeReq(`http://localhost/api/loans/${loanId}?asOf=2025-10-12`, { headers: authHeader() }),
      { params: { loanId } },
    );
    const getBody = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getBody.data.position.overdueAmount).toBe('0.00');
    expect(getBody.data.position.outstandingPrincipal).toBe('193015.18');
  });
});

describe('I2 — Validation failure: negative amount', () => {
  it('returns 422 VALIDATION_ERROR with field details, no payment row written', async () => {
    const { createLoan, recordPayment } = await getHandlers();

    const { data: { id: loanId } } = await (await createLoan(
      makeReq('http://localhost/api/loans', { method: 'POST', body: LOAN_BODY, headers: authHeader() }),
    )).json();

    const res  = await recordPayment(
      makeReq(`http://localhost/api/loans/${loanId}/payments`, {
        method: 'POST',
        body: { amount: '-100.00', paymentDate: '2025-10-01' },
        headers: authHeader(),
      }),
      { params: { loanId } },
    );
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.length).toBeGreaterThan(0);
    expect(await prismaTest.payment.count({ where: { loanId } })).toBe(0);
  });
});

describe('I3 — Unauthenticated requests rejected before any DB query', () => {
  it('returns 401 UNAUTHENTICATED from all three routes', async () => {
    const { createLoan, getLoan, recordPayment } = await getHandlers();
    const fakeId = '00000000-0000-0000-0000-000000000001';

    const r1 = await createLoan(makeReq('http://localhost/api/loans', { method: 'POST', body: {} }));
    expect(r1.status).toBe(401);
    expect((await r1.json()).error.code).toBe('UNAUTHENTICATED');

    const r2 = await getLoan(makeReq(`http://localhost/api/loans/${fakeId}`), { params: { loanId: fakeId } });
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
    const res  = await getLoan(makeReq(`http://localhost/api/loans/${fakeId}`, { headers: authHeader() }), { params: { loanId: fakeId } });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('LOAN_NOT_FOUND');
  });
});
