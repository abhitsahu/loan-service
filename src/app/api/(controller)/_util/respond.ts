import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';
import type { ApiSuccess, ApiError } from '@/app/api/model/response/api-response';

export function ok<T>(data: T, status = 200, meta?: Record<string, unknown>): NextResponse {
  const body: ApiSuccess<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return NextResponse.json(body, { status });
}

export function fail(
  code: ErrorCode,
  status: number,
  message?: string,
  details?: Array<{ field: string; message: string }>,
): NextResponse {
  const body: ApiError = {
    success: false,
    error: {
      code,
      message: message ?? code,
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

/**
 * Wraps a route handler so AppError instances produce clean JSON error responses
 * and all other exceptions become 500 INTERNAL_ERROR (with server-side logging only).
 */
export function withErrorHandling(
  handler: (req: NextRequest, ctx?: unknown) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        const details = (err as AppError & { details?: Array<{ field: string; message: string }> }).details;
        return fail(err.code, err.statusCode, err.message, details);
      }
      console.error('[INTERNAL]', err);
      return fail(ErrorCode.INTERNAL_ERROR, 500);
    }
  };
}
