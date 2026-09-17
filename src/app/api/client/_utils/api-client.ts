import { auth } from '@/app/_lib/firebase-client';
import type { ApiResponse } from '@/app/api/model/response/api-response';

const BASE = '/api';

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  extraHeaders: Record<string, string> = {},
): Promise<ApiResponse<T>> {
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  return res.json() as Promise<ApiResponse<T>>;
}
