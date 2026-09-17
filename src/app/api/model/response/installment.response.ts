export interface InstallmentResponse {
  installmentNumber: number;
  dueDate: string;
  openingBalance: string;
  principalComponent: string;
  interestComponent: string;
  totalDue: string;
  amountPaid: string;
  principalPaid: string;
  interestPaid: string;
  remainingDue: string;
  closingBalance: string;
  status: string;
  settledOn: string | null;
  isOverdue: boolean;
  daysPastDue: number;
}
