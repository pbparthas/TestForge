/**
 * Device Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Device, DeviceType } from '@prisma/client';

const { mockPrisma, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    device: {
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

describe('Device Routes Integration', () => {
  const mockDevice: Device = {
    id: '11111111-1111-1111-1111-111111111111',
    projectId: '22222222-2222-2222-2222-222222222222',
    name: 'Chrome Desktop',
    type: 'browser' as DeviceType,
    config: { browser: 'chromium', viewport: { width: 1920, height: 1080 } },
    isActive: true,
    createdAt: new Date(),
  };

  const adminToken = 'admin_test_token';

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', role: 'admin', isActive: true });
  });

  describe('GET /api/devices', () => {
    it('should return paginated devices', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice]);
      mockPrisma.device.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
    });
  });

  describe('POST /api/devices', () => {
    it('should create a device', async () => {
      mockPrisma.device.create.mockResolvedValue(mockDevice);

      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '22222222-2222-2222-2222-222222222222',
          name: 'Chrome Desktop',
          type: 'browser',
          config: { browser: 'chromium' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Chrome Desktop');
    });
  });

  describe('GET /api/devices/:id', () => {
    it('should return device by id', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);

      const res = await request(app)
        .get('/api/devices/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('11111111-1111-1111-1111-111111111111');
    });
  });

  describe('PATCH /api/devices/:id', () => {
    it('should update device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockPrisma.device.update.mockResolvedValue({ ...mockDevice, name: 'Firefox Desktop' });

      const res = await request(app)
        .patch('/api/devices/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Firefox Desktop' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Firefox Desktop');
    });
  });

  describe('DELETE /api/devices/:id', () => {
    it('should delete device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice);
      mockPrisma.device.delete.mockResolvedValue(mockDevice);

      const res = await request(app)
        .delete('/api/devices/11111111-1111-1111-1111-111111111111')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});
