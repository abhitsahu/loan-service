export interface LoanResponse {
  id: string;
  principal: string;
  annualInterestRate: string;
  tenureMonths: number;
  disbursementDate: string;
  emiAmount: string;
  totalInterest: string;
  totalPayable: string;
  status: string;
  installmentCount?: number;
}
