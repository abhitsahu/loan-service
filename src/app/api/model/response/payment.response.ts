import type { LoanResponse } from '@/app/api/model/response/loan.response';
import type { InstallmentResponse } from '@/app/api/model/response/installment.response';
import type { PositionResponse } from '@/app/api/model/response/position.response';

export interface PaymentRecord {
  id: string;
  loanId: string;
  amount: string;
  paymentDate: string;
  allocatedAmount: string;
  unallocatedAmount: string;
}

export interface AllocationRecord {
  installmentNumber: number;
  component: string;
  amount: string;
}

export interface RecordPaymentResponse {
  payment: PaymentRecord;
  allocations: AllocationRecord[];
  position: {
    outstandingPrincipal: string;
    nextDueDate: string | null;
    nextDueAmount: string | null;
    overdueAmount: string;
    daysPastDue: number;
  };
}

export interface GetLoanResponse {
  loan: LoanResponse;
  schedule: InstallmentResponse[];
  position: PositionResponse;
  payments: PaymentRecord[];
}
