import { NextRequest } from 'next/server';
import { requireAuth } from '@/app/api/(controller)/_util/auth-guard';
import { validate } from '@/app/api/(controller)/_util/validate';
import { ok, withErrorHandling } from '@/app/api/(controller)/_util/respond';
import { CreateLoanSchema } from '@/app/api/model/request/create-loan.request';
import { createLoan } from '@/app/service/loan/loan.service';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);  
  const body = await validate(CreateLoanSchema, req);
  const loan = await createLoan(body);
  return ok(loan, 201);
});
