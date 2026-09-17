import { z } from 'zod';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a numeric string with at most 2 decimal places')
  .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0');

export const RecordPaymentSchema = z.object({
  amount: decimalString,
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format'),
  reference: z.string().optional(),
});

export type RecordPaymentRequest = z.infer<typeof RecordPaymentSchema> & {
  idempotencyKey?: string;
};
