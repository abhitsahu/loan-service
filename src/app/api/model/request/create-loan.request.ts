import { z } from 'zod';

// Accept money as a numeric string — keeps floating point out of the system
const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a numeric string with at most 2 decimal places');

export const CreateLoanSchema = z.object({
  principal: decimalString
    .refine((v) => {
      const n = parseFloat(v);
      return n >= 50000 && n <= 1000000;
    }, 'Principal must be between ₹50,000 and ₹10,00,000'),
  annualInterestRate: decimalString.refine(
    (v) => {
      const n = parseFloat(v);
      return n >= 0 && n < 100;
    },
    'Annual interest rate must be between 0 and 100',
  ),
  tenureMonths: z
    .number()
    .int('Must be a whole number')
    .min(3, 'Minimum tenure is 3 months')
    .max(36, 'Maximum tenure is 36 months'),
  disbursementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format'),
});

export type CreateLoanRequest = z.infer<typeof CreateLoanSchema>;
