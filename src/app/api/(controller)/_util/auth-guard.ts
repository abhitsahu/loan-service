import { NextRequest } from 'next/server';
import { adminAuth } from '@/app/_lib/firebase-admin';
import { AppError } from '@/lib/errors';
import { ErrorCode } from '@/app/api/model/enums/error-code';

export interface AuthContext {
  uid: string;
  email: string | null;
}

// Verifies Firebase ID token from Authorization header.
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
    const decoded = await adminAuth.verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 401);
  }
}
