/**
 * Security Config Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { SALT_ROUNDS } from '../../../src/utils/security-config.js';

describe('security-config', () => {
  describe('SALT_ROUNDS', () => {
    it('should export SALT_ROUNDS as a number', () => {
      expect(typeof SALT_ROUNDS).toBe('number');
    });

    it('should be at least 10 (NIST minimum recommendation)', () => {
      expect(SALT_ROUNDS).toBeGreaterThanOrEqual(10);
    });

    it('should be at most 14 (reasonable upper bound for performance)', () => {
      expect(SALT_ROUNDS).toBeLessThanOrEqual(14);
    });

    it('should be 12 (current project standard)', () => {
      expect(SALT_ROUNDS).toBe(12);
    });
  });
});
