import { NextRequest } from 'next/server';
import { adminAuth } from '@/app/_lib/firebase-admin';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';

export interface AuthContext {
  uid: string;
  email: string | null;
}

/**
 * Verifies the Firebase ID token in the Authorization header.
 * Throws AppError(UNAUTHENTICATED, 401) for any failure.
 *
 * Applied as the FIRST statement in every route handler — zero DB queries
 * execute for unauthenticated requests.
 *
 * Note: Route-level guards are used instead of middleware.ts because the
 * Firebase Admin SDK requires the Node.js runtime, while Next.js middleware
 * runs on the Edge runtime.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const header = req.headers.get('authorization') ?? '';

  if (!header.startsWith('Bearer ')) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token, /* checkRevoked */ true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    // Expired, malformed, wrong aud/iss, or revoked token
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
}
