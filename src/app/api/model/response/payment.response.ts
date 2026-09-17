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
  loan: import('./loan.response').LoanResponse;
  schedule: import('./installment.response').InstallmentResponse[];
  position: import('./position.response').PositionResponse;
  payments: PaymentRecord[];
}
