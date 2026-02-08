/**
 * CSRF Middleware Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { csrfProtection, generateCsrfToken, setCsrfCookie } from '../../../src/middleware/csrf.middleware.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/test',
    cookies: {},
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn(),
  } as unknown as Response;
  return res;
}

describe('CSRF Middleware', () => {
  let next: NextFunction;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    // Override NODE_ENV so CSRF middleware doesn't skip in test mode
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens', () => {
      const t1 = generateCsrfToken();
      const t2 = generateCsrfToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('setCsrfCookie', () => {
    it('should set non-httpOnly cookie with correct options', () => {
      const res = mockRes();
      setCsrfCookie(res, 'test-token');

      expect(res.cookie).toHaveBeenCalledWith('csrf_token', 'test-token', {
        httpOnly: false,
        secure: false, // NODE_ENV is 'test', not 'production'
        sameSite: 'strict',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
    });
  });

  describe('csrfProtection', () => {
    it('should skip GET requests', () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip HEAD requests', () => {
      const req = mockReq({ method: 'HEAD' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should skip OPTIONS requests', () => {
      const req = mockReq({ method: 'OPTIONS' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should skip webhook path', () => {
      const req = mockReq({ method: 'POST', path: '/api/git/webhook' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should skip health check path', () => {
      const req = mockReq({ method: 'POST', path: '/health' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject POST without CSRF token', () => {
      const req = mockReq({ method: 'POST' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'CSRF_ERROR',
          message: 'CSRF token missing',
        },
      });
    });

    it('should reject when cookie present but header missing', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: 'some-token' },
      });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject when header present but cookie missing', () => {
      const req = mockReq({
        method: 'POST',
        headers: { 'x-csrf-token': 'some-token' },
      });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject when tokens do not match', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: 'a'.repeat(64) },
        headers: { 'x-csrf-token': 'b'.repeat(64) },
      });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'CSRF_ERROR',
          message: 'CSRF token mismatch',
        },
      });
    });

    it('should reject when token lengths differ', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: 'short' },
        headers: { 'x-csrf-token': 'longer-token' },
      });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should pass when tokens match', () => {
      const token = generateCsrfToken();
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: token },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should validate PUT requests', () => {
      const req = mockReq({ method: 'PUT' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should validate DELETE requests', () => {
      const req = mockReq({ method: 'DELETE' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should validate PATCH requests', () => {
      const req = mockReq({ method: 'PATCH' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should skip validation in test environment', () => {
      process.env.NODE_ENV = 'test';
      const req = mockReq({ method: 'POST' });
      const res = mockRes();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
