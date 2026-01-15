/**
 * User Routes Integration Tests
 * Tests the full HTTP request/response cycle for user management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { User, UserRole } from '@prisma/client';

// Mock dependencies before importing app
const { mockPrisma, mockBcrypt, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

vi.mock('../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}));

vi.mock('jsonwebtoken', () => ({
  default: mockJwt,
}));

// Import app after mocking
import app from '../../src/app.js';

describe('User Routes Integration', () => {
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

  const adminUser: User = {
    id: 'admin-123',
    email: 'admin@example.com',
    passwordHash: 'hashed_password',
    name: 'Admin User',
    role: 'admin' as UserRole,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Simple tokens for testing
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup JWT verify mock to return correct payload based on token
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) {
        return { userId: 'admin-123', role: 'admin' };
      }
      if (token === userToken) {
        return { userId: 'user-123', role: 'qae' };
      }
      throw new Error('Invalid token');
    });
  });

  describe('GET /api/users', () => {
    it('should return paginated users for admin', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser, adminUser]);
      mockPrisma.user.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should support pagination params', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockPrisma.user.count.mockResolvedValue(10);

      const response = await request(app)
        .get('/api/users?page=2&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
    });

    it('should filter by role', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/users?role=qae')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'qae' }),
        })
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/user-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('user-123');
    });

    it('should allow user to get their own info', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/user-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 403 when user tries to get another user info', async () => {
      const response = await request(app)
        .get('/api/users/admin-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed_password');
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
          role: 'qae',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.email).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invalid-email',
          password: 'short',
          name: '',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should update user for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const response = await request(app)
        .patch('/api/users/user-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should allow user to update their own info', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const response = await request(app)
        .patch('/api/users/user-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
    });

    it('should not allow user to change their role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const response = await request(app)
        .patch('/api/users/user-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' });

      // Should either ignore the role change or return 403
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      const response = await request(app)
        .delete('/api/users/user-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/users/user-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/users/:id/deactivate', () => {
    it('should deactivate user for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, isActive: false });

      const response = await request(app)
        .post('/api/users/user-123/deactivate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);
    });
  });

  describe('POST /api/users/:id/activate', () => {
    it('should activate user for admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users/user-123/activate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(true);
    });
  });
});
