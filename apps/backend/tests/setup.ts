/**
 * Vitest setup file
 * Runs before all tests
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Required secrets for centralized config (Sprint 5)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-vitest';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/testforge_test';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

// Mock logger to avoid noise in tests
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

beforeAll(() => {
  // Global test setup
});

afterAll(() => {
  // Global test cleanup
});
