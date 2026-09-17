import { NextRequest } from 'next/server';
import { requireAuth } from '../../../_util/auth-guard';
import { validate, assertUuid } from '../../../_util/validate';
import { ok, withErrorHandling } from '../../../_util/respond';
import { RecordPaymentSchema } from '@/app/api/model/request/record-payment.request';
import { recordPayment } from '@/app/service/payment/payment.service';

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: unknown) => {
    await requireAuth(req);                             // ① 401 gate
    const { loanId } = (ctx as { params: { loanId: string } }).params;
    const validId = assertUuid(loanId);
    const body = await validate(RecordPaymentSchema, req);
    const idempotencyKey = req.headers.get('idempotency-key') ?? undefined;

    const result = await recordPayment(validId, { ...body, idempotencyKey });
    return ok(result, 201);
  },
);
