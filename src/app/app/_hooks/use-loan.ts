'use client';

import useSWR from 'swr';
import { loanClient } from '@/app/api/client/loan-client';
import type { GetLoanResponse } from '@/app/api/model/response/payment.response';

export function useLoan(loanId: string | null) {
  const { data, error, mutate, isLoading } = useSWR(
    loanId ? `/api/loans/${loanId}` : null,
    async () => {
      if (!loanId) return null;
      const res = await loanClient.getLoan(loanId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    { revalidateOnFocus: false },
  );

  return {
    loan: data as GetLoanResponse | undefined,
    isLoading,
    error: error as Error | undefined,
    mutate,
  };
}
