/**
 * Permission Routes Integration Tests
 * Tests the full HTTP request/response cycle for permission management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Permission, UserPermission } from '@prisma/client';

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
    permission: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    role: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    rolePermission: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    userPermission: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userRoleAssignment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

describe('Permission Routes Integration', () => {
  const mockPermission: Permission = {
    id: 'perm-123',
    name: 'project.create',
    description: 'Create projects',
    resource: 'project',
    action: 'create',
    createdAt: new Date(),
  };

  const mockUserPermission: UserPermission = {
    id: 'up-123',
    userId: 'user-123',
    permissionId: 'perm-123',
    projectId: null,
    isGranted: true,
    grantedAt: new Date(),
    grantedBy: 'admin-123',
    expiresAt: null,
  };

  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  beforeEach(() => {
    vi.clearAllMocks();

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

  // =============================================================================
  // PERMISSION CRUD
  // =============================================================================

  describe('GET /api/permissions', () => {
    it('should return all permissions for authenticated user', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      const response = await request(app)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by resource', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      const response = await request(app)
        .get('/api/permissions?resource=project')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resource: 'project' }),
        })
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/permissions');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/permissions/:id', () => {
    it('should return permission by id', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);

      const response = await request(app)
        .get('/api/permissions/perm-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('perm-123');
    });

    it('should return 404 for non-existent permission', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/permissions/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/permissions', () => {
    it('should create permission for admin', async () => {
      mockPrisma.permission.create.mockResolvedValue(mockPermission);

      const response = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'project.create',
          description: 'Create projects',
          resource: 'project',
          action: 'create',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('project.create');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'project.create',
          resource: 'project',
          action: 'create',
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty name should fail
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/permissions/:id', () => {
    it('should delete permission for admin', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.permission.delete.mockResolvedValue(mockPermission);

      const response = await request(app)
        .delete('/api/permissions/perm-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/permissions/perm-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  // =============================================================================
  // USER PERMISSION MANAGEMENT
  // =============================================================================

  describe('POST /api/permissions/grant', () => {
    it('should grant permission to user for admin', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.create.mockResolvedValue(mockUserPermission);

      const response = await request(app)
        .post('/api/permissions/grant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: '00000000-0000-0000-0000-000000000123',
          permissionId: '00000000-0000-0000-0000-000000000456',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.isGranted).toBe(true);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/permissions/grant')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: '00000000-0000-0000-0000-000000000123',
          permissionId: '00000000-0000-0000-0000-000000000456',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/permissions/deny', () => {
    it('should deny permission to user for admin', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.create.mockResolvedValue({
        ...mockUserPermission,
        isGranted: false,
      });

      const response = await request(app)
        .post('/api/permissions/deny')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: '00000000-0000-0000-0000-000000000123',
          permissionId: '00000000-0000-0000-0000-000000000456',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.isGranted).toBe(false);
    });
  });

  describe('DELETE /api/permissions/user/:userId/:permissionId', () => {
    it('should remove permission from user for admin', async () => {
      mockPrisma.userPermission.findUnique.mockResolvedValue(mockUserPermission);
      mockPrisma.userPermission.delete.mockResolvedValue(mockUserPermission);

      const response = await request(app)
        .delete('/api/permissions/user/user-123/perm-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/permissions/user/:userId', () => {
    it('should return direct permissions for user', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { ...mockUserPermission, permission: mockPermission },
      ]);

      const response = await request(app)
        .get('/api/permissions/user/user-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/permissions/user/:userId/effective', () => {
    it('should return effective permissions including role-based', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { ...mockUserPermission, permission: mockPermission },
      ]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/permissions/user/user-123/effective')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });
  });

  // =============================================================================
  // PERMISSION CHECKING
  // =============================================================================

  describe('POST /api/permissions/check', () => {
    it('should check if user has permission', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([mockUserPermission]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/permissions/check')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          resource: 'project',
          action: 'create',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('hasPermission');
    });

    it('should return 400 for missing resource', async () => {
      const response = await request(app)
        .post('/api/permissions/check')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          action: 'create',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/permissions/check-bulk', () => {
    it('should check multiple permissions', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/permissions/check-bulk')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          checks: [
            { resource: 'project', action: 'create' },
            { resource: 'project', action: 'delete' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('project.create');
      expect(response.body.data).toHaveProperty('project.delete');
    });
  });

  describe('GET /api/permissions/my-permissions', () => {
    it('should return permissions for current user', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { ...mockUserPermission, permission: mockPermission },
      ]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/permissions/my-permissions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });
  });
});
