import { NextRequest } from 'next/server';
import { requireAuth } from '../_util/auth-guard';
import { validate } from '../_util/validate';
import { ok, withErrorHandling } from '../_util/respond';
import { CreateLoanSchema } from '@/app/api/model/request/create-loan.request';
import { createLoan } from '@/app/service/loan/loan.service';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);                              // ① 401 gate
  const body = await validate(CreateLoanSchema, req);  // ② 422 gate
  const loan = await createLoan(body);
  return ok(loan, 201);
});
