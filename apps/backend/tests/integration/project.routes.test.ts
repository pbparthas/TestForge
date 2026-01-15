/**
 * Project Routes Integration Tests
 * Tests the full HTTP request/response cycle for project management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Project, Framework, Language, UserRole } from '@prisma/client';

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
    project: {
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

describe('Project Routes Integration', () => {
  const mockProject: Project = {
    id: 'project-123',
    name: 'Test Project',
    description: 'A test project',
    repositoryUrl: 'https://github.com/test/repo',
    framework: 'playwright' as Framework,
    language: 'typescript' as Language,
    createdById: 'user-123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Simple tokens for testing
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';
  const leadToken = 'lead_test_token';

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
      if (token === leadToken) {
        return { userId: 'lead-123', role: 'lead' };
      }
      throw new Error('Invalid token');
    });
  });

  describe('GET /api/projects', () => {
    it('should return paginated projects for authenticated user', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);
      mockPrisma.project.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    it('should support pagination params', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);
      mockPrisma.project.count.mockResolvedValue(10);

      const response = await request(app)
        .get('/api/projects?page=2&limit=5')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
    });

    it('should filter by framework', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);
      mockPrisma.project.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/projects?framework=playwright')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ framework: 'playwright' }),
        })
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project by id', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const response = await request(app)
        .get('/api/projects/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('project-123');
    });

    it('should return 404 for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/projects/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project for admin', async () => {
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Project',
          description: 'A new project',
          framework: 'playwright',
          language: 'typescript',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBeDefined();
    });

    it('should create a new project for lead', async () => {
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          name: 'New Project',
          description: 'A new project',
        });

      expect(response.status).toBe(201);
    });

    it('should return 403 for qae users', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Project',
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty name should fail
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update project for admin', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({ ...mockProject, name: 'Updated Project' });

      const response = await request(app)
        .patch('/api/projects/project-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Project' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Project');
    });

    it('should return 403 for qae users', async () => {
      const response = await request(app)
        .patch('/api/projects/project-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Project' });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/projects/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Project' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project for admin', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.delete.mockResolvedValue(mockProject);

      const response = await request(app)
        .delete('/api/projects/project-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/projects/project-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/projects/:id/deactivate', () => {
    it('should deactivate project for admin', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({ ...mockProject, isActive: false });

      const response = await request(app)
        .post('/api/projects/project-123/deactivate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);
    });
  });

  describe('POST /api/projects/:id/activate', () => {
    it('should activate project for admin', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ ...mockProject, isActive: false });
      mockPrisma.project.update.mockResolvedValue(mockProject);

      const response = await request(app)
        .post('/api/projects/project-123/activate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(true);
    });
  });

  describe('GET /api/projects/:id/stats', () => {
    it('should return project statistics', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        _count: {
          requirements: 5,
          testCases: 20,
          environments: 3,
          testSuites: 2,
        },
      });

      const response = await request(app)
        .get('/api/projects/project-123/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.requirementCount).toBe(5);
      expect(response.body.data.testCaseCount).toBe(20);
    });
  });
});
