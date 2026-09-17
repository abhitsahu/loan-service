import { NextRequest } from 'next/server';
import { requireAuth } from '../../_util/auth-guard';
import { assertUuid } from '../../_util/validate';
import { ok, withErrorHandling } from '../../_util/respond';
import { getLoan } from '@/app/service/loan/loan.service';

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: unknown) => {
    await requireAuth(req);                            // ① 401 gate
    const { loanId } = (ctx as { params: { loanId: string } }).params;
    const validId = assertUuid(loanId);

    const asOfParam = new URL(req.url).searchParams.get('asOf');
    const asOf = asOfParam ? new Date(`${asOfParam}T00:00:00.000Z`) : undefined;

    const data = await getLoan(validId, asOf);
    return ok(data);
  },
);
