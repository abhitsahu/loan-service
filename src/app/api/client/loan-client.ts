import { apiRequest } from './_utils/api-client';
import type { CreateLoanRequest } from '@/app/api/model/request/create-loan.request';
import type { RecordPaymentRequest } from '@/app/api/model/request/record-payment.request';
import type { LoanResponse } from '@/app/api/model/response/loan.response';
import type { GetLoanResponse, RecordPaymentResponse } from '@/app/api/model/response/payment.response';
import type { ApiResponse } from '@/app/api/model/response/api-response';
import { v4 as uuidv4 } from 'uuid';

export const loanClient = {
  createLoan(req: CreateLoanRequest): Promise<ApiResponse<LoanResponse>> {
    return apiRequest<LoanResponse>('/loans', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  getLoan(loanId: string, asOf?: string): Promise<ApiResponse<GetLoanResponse>> {
    const qs = asOf ? `?asOf=${asOf}` : '';
    return apiRequest<GetLoanResponse>(`/loans/${loanId}${qs}`);
  },

  recordPayment(
    loanId: string,
    req: Omit<RecordPaymentRequest, 'idempotencyKey'>,
    idempotencyKey = uuidv4(),
  ): Promise<ApiResponse<RecordPaymentResponse>> {
    return apiRequest<RecordPaymentResponse>(
      `/loans/${loanId}/payments`,
      { method: 'POST', body: JSON.stringify(req) },
      { 'Idempotency-Key': idempotencyKey },
    );
  },
};
