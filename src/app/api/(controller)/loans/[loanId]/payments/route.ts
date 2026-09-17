import { NextRequest } from 'next/server';
import { requireAuth } from '@/app/api/(controller)/_util/auth-guard';
import { validate, assertUuid } from '@/app/api/(controller)/_util/validate';
import { ok, withErrorHandling } from '@/app/api/(controller)/_util/respond';
import { RecordPaymentSchema } from '@/app/api/model/request/record-payment.request';
import { recordPayment } from '@/app/service/payment/payment.service';

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: unknown) => {
    await requireAuth(req);                             
    const { loanId } = await (ctx as { params: Promise<{ loanId: string }> }).params;
    const validId = assertUuid(loanId);
    const body = await validate(RecordPaymentSchema, req);
    const idempotencyKey = req.headers.get('idempotency-key') ?? undefined;

    const result = await recordPayment(validId, { ...body, idempotencyKey });
    return ok(result, 201);
  },
);
