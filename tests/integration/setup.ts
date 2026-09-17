import { vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const TEST_TOKEN = 'test-firebase-token-valid';
export const TEST_UID   = 'test-uid-001';

vi.mock('@/app/_lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn((token: string) => {
      if (token === TEST_TOKEN) {
        return Promise.resolve({ uid: TEST_UID, email: 'test@example.com' });
      }
      return Promise.reject(new Error('Mocked: invalid token'));
    }),
  },
}));

export function authHeader(token = TEST_TOKEN): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function makeReq(
  url: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

export const prismaTest = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

beforeEach(async () => {
  await prismaTest.$executeRawUnsafe(
    'TRUNCATE TABLE payment_allocations, payments, installments, loans RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prismaTest.$disconnect();
});

export async function getHandlers() {
  const { POST: createLoan } = await import('@/app/api/(controller)/loans/route');
  const { GET: getLoan }     = await import('@/app/api/(controller)/loans/[loanId]/route');
  const { POST: recordPayment } = await import('@/app/api/(controller)/loans/[loanId]/payments/route');
  return { createLoan, getLoan, recordPayment };
}

export const LOAN_BODY = {
  principal: '200000.00',
  annualInterestRate: '18',
  tenureMonths: 24,
  disbursementDate: '2025-09-01',
} as const;
