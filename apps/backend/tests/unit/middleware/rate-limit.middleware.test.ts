/**
 * Rate Limit Middleware Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { authLimiter, aiLimiter, defaultLimiter } from '../../../src/middleware/rate-limit.middleware.js';

describe('Rate Limit Middleware', () => {
  describe('authLimiter', () => {
    it('should be a function (Express middleware)', () => {
      expect(typeof authLimiter).toBe('function');
    });
  });

  describe('aiLimiter', () => {
    it('should be a function (Express middleware)', () => {
      expect(typeof aiLimiter).toBe('function');
    });
  });

  describe('defaultLimiter', () => {
    it('should be a function (Express middleware)', () => {
      expect(typeof defaultLimiter).toBe('function');
    });
  });
});
