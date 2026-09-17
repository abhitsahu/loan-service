import { NextRequest } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';

/**
 * Parses and validates the request body against a Zod schema.
 * Throws AppError(VALIDATION_ERROR, 422) with field-level details on failure.
 */
export async function validate<T>(schema: ZodSchema<T>, req: NextRequest): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, 'Invalid JSON body');
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    const err = new AppError(ErrorCode.VALIDATION_ERROR, 422, 'Validation failed');
    (err as any).details = details;
    throw err;
  }

  return result.data;
}

/** Assert a string is a valid UUID — otherwise 422 */
export function assertUuid(value: string): string {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(value)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, `Invalid UUID: ${value}`);
  }
  return value;
}
