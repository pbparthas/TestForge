/**
 * Auth Service Tests (TDD - RED phase)
 * These tests define the expected behavior before implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User, UserRole } from '@prisma/client';

// Mock dependencies
const { mockPrisma, mockBcrypt, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockBcrypt: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  mockJwt: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}));

vi.mock('jsonwebtoken', () => ({
  default: mockJwt,
}));

// Import after mocking
import { AuthService } from '../../../src/services/auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    name: 'Test User',
    role: 'qae' as UserRole,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockJwt.sign.mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
    });

    it('should throw ConflictError if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should hash password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockJwt.sign.mockReturnValue('token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
    });

    it('should throw UnauthorizedError for invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedError for invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedError for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Account is inactive');
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens for valid refresh token', async () => {
      const storedToken = {
        id: 'token-id',
        token: 'old_refresh_token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        isRevoked: false,
      };

      mockJwt.verify.mockReturnValue({ userId: 'user-123' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({});
      mockJwt.sign.mockReturnValueOnce('new_access_token').mockReturnValueOnce('new_refresh_token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.refreshTokens('old_refresh_token');

      expect(result.accessToken).toBe('new_access_token');
      expect(result.refreshToken).toBe('new_refresh_token');
    });

    it('should throw UnauthorizedError for invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshTokens('invalid_token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should throw UnauthorizedError for expired refresh token', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'token-id',
        token: 'expired_token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 3600000), // Expired
        isRevoked: false,
      });

      await expect(authService.refreshTokens('expired_token')).rejects.toThrow(
        'Refresh token expired'
      );
    });

    it('should throw UnauthorizedError for revoked refresh token', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'token-id',
        token: 'revoked_token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000),
        isRevoked: true,
      });

      await expect(authService.refreshTokens('revoked_token')).rejects.toThrow(
        'Refresh token revoked'
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should return payload for valid access token', () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        role: 'qae',
      });

      const result = authService.verifyAccessToken('valid_token');

      expect(result.userId).toBe('user-123');
      expect(result.role).toBe('qae');
    });

    it('should throw UnauthorizedError for invalid access token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyAccessToken('invalid_token')).toThrow('Invalid access token');
    });
  });

  describe('logout', () => {
    it('should revoke all user refresh tokens', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await authService.logout('user-123');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('changePassword', () => {
    it('should update password for valid current password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue('new_hashed_password');
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({});

      await authService.changePassword('user-123', 'oldpassword', 'newpassword');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: 'new_hashed_password' },
      });
    });

    it('should throw UnauthorizedError for wrong current password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.changePassword('user-123', 'wrongpassword', 'newpassword')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should invalidate all refresh tokens after password change', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue('new_hashed_password');
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({});

      await authService.changePassword('user-123', 'oldpassword', 'newpassword');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });
});
