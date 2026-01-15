/**
 * Script Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Script, ScriptStatus, Language, Framework } from '@prisma/client';

const { mockPrisma, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    script: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import app from '../../src/app.js';

describe('Script Routes Integration', () => {
  const mockScript: Script = {
    id: '11111111-1111-1111-1111-111111111111',
    testCaseId: '22222222-2222-2222-2222-222222222222',
    projectId: '33333333-3333-3333-3333-333333333333',
    name: 'Login Test Script',
    code: 'test("login", async () => { /* ... */ });',
    language: 'typescript' as Language,
    framework: 'playwright' as Framework,
    version: 1,
    status: 'draft' as ScriptStatus,
    generatedBy: 'manual',
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminToken = 'admin_test_token';

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', role: 'admin', isActive: true });
  });

  describe('GET /api/scripts', () => {
    it('should return paginated scripts', async () => {
      mockPrisma.script.findMany.mockResolvedValue([mockScript]);
      mockPrisma.script.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/scripts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
    });
  });

  describe('POST /api/scripts', () => {
    it('should create a script', async () => {
      mockPrisma.script.create.mockResolvedValue(mockScript);

      const res = await request(app)
        .post('/api/scripts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          testCaseId: '22222222-2222-2222-2222-222222222222',
          projectId: '33333333-3333-3333-3333-333333333333',
          name: 'Login Test Script',
          code: 'test("login", async () => { /* ... */ });',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Login Test Script');
    });
  });

  describe('GET /api/scripts/:id', () => {
    it('should return script by id', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);

      const res = await request(app)
        .get('/api/scripts/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('11111111-1111-1111-1111-111111111111');
    });
  });

  describe('POST /api/scripts/:id/approve', () => {
    it('should approve script', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.update.mockResolvedValue({ ...mockScript, status: 'approved' });

      const res = await request(app)
        .post('/api/scripts/11111111-1111-1111-1111-111111111111/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });
  });

  describe('POST /api/scripts/:id/version', () => {
    it('should increment version with new code', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.update.mockResolvedValue({ ...mockScript, version: 2, code: 'updated code' });

      const res = await request(app)
        .post('/api/scripts/11111111-1111-1111-1111-111111111111/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'updated code' });

      expect(res.status).toBe(200);
      expect(res.body.data.version).toBe(2);
    });
  });

  describe('DELETE /api/scripts/:id', () => {
    it('should delete script', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.delete.mockResolvedValue(mockScript);

      const res = await request(app)
        .delete('/api/scripts/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});
