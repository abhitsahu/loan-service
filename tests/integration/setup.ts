/**
 * Integration test setup:
 * - Stubs Firebase Admin verifyIdToken to accept a fixed token
 * - Provides a truncate helper called before each suite
 */
import { vi, beforeEach } from 'vitest';

export const TEST_TOKEN = 'test-firebase-token-valid';
export const TEST_UID   = 'test-uid-001';

// Mock Firebase Admin so integration tests don't need a live Firebase project
vi.mock('../../src/app/_lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn((token: string) => {
      if (token === TEST_TOKEN) {
        return Promise.resolve({ uid: TEST_UID, email: 'test@example.com' });
      }
      return Promise.reject(new Error('Mocked: invalid token'));
    }),
  },
}));

export function authHeader(token = TEST_TOKEN) {
  return { Authorization: `Bearer ${token}` };
}
