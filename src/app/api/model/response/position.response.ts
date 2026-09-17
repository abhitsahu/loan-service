export interface PositionResponse {
  outstandingPrincipal: string;
  outstandingTotal: string;
  totalPaid: string;
  nextDueDate: string | null;
  nextDueAmount: string | null;
  overdueAmount: string;
  overdueInstallmentCount: number;
  daysPastDue: number;
  asOf: string;
}
