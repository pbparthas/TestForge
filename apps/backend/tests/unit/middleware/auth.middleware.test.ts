/**
 * Auth Middleware Tests (TDD - RED phase)
 * Tests for authentication middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';

// Mock AuthService
const { mockAuthService } = vi.hoisted(() => ({
  mockAuthService: {
    verifyAccessToken: vi.fn(),
  },
}));

vi.mock('../../../src/services/auth.service.js', () => ({
  authService: mockAuthService,
}));

// Import after mocking
import { authenticate, authorize } from '../../../src/middleware/auth.middleware.js';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    it('should call next() for valid token', () => {
      mockRequest.headers = { authorization: 'Bearer valid_token' };
      mockAuthService.verifyAccessToken.mockReturnValue({
        userId: 'user-123',
        role: 'qae' as UserRole,
      });

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as Request & { user: unknown }).user).toEqual({
        userId: 'user-123',
        role: 'qae',
      });
    });

    it('should return 401 if no authorization header', () => {
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header is malformed', () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', () => {
      mockRequest.headers = { authorization: 'Bearer invalid_token' };
      mockAuthService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    beforeEach(() => {
      // Setup authenticated user
      (mockRequest as Request & { user: { userId: string; role: UserRole } }).user = {
        userId: 'user-123',
        role: 'qae' as UserRole,
      };
    });

    it('should call next() if user has required role', () => {
      const middleware = authorize(['qae', 'admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 if user does not have required role', () => {
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'FORBIDDEN',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      (mockRequest as Request & { user: unknown }).user = undefined;
      const middleware = authorize(['qae']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work with single role', () => {
      (mockRequest as Request & { user: { userId: string; role: UserRole } }).user = {
        userId: 'user-123',
        role: 'admin' as UserRole,
      };
      const middleware = authorize(['admin']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with multiple roles', () => {
      (mockRequest as Request & { user: { userId: string; role: UserRole } }).user = {
        userId: 'user-123',
        role: 'lead' as UserRole,
      };
      const middleware = authorize(['admin', 'lead', 'qae']);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
