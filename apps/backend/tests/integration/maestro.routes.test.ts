/**
 * Maestro Routes Integration Tests
 * Tests for registry sync, flow generation, and YAML validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockPrisma, mockJwt, mockAnthropicCreate, mockFetch } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
  },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
  mockAnthropicCreate: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate };
  },
}));

// Mock global fetch for registry sync
global.fetch = mockFetch;

import app from '../../src/app.js';

describe('Maestro Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const projectId = 'proj-12345678';

  const mockRegistry = {
    appId: 'com.bankbazaar.app',
    version: 'abc123',
    generated: '2026-02-02T12:00:00Z',
    widgetCount: 3,
    widgets: [
      { eventName: 'Login', file: 'auth/login_screen.dart', type: 'TextField' },
      { eventName: 'LoginAttempt', file: 'auth/login_screen.dart', type: 'Button' },
      { eventName: 'home_check_score_cta', file: 'home/home_body.dart', type: 'Button' },
    ],
  };

  const mockConfig = {
    enabled: true,
    gitlab: {
      host: 'https://gitlab.com',
      projectId: '12345',
      branch: 'main',
      jobName: 'extract-maestro-registry',
      artifactPath: 'maestro_registry.json',
      accessToken: 'test-token',
    },
    defaultAppId: 'com.bankbazaar.app',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', role: 'admin', isActive: true });
    mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, name: 'Test Project' });
  });

  describe('POST /api/maestro/config', () => {
    it('should set Maestro config for a project', async () => {
      const res = await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          config: mockConfig,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Maestro configuration saved');
    });

    it('should require projectId', async () => {
      const res = await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          config: mockConfig,
        });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/maestro/config')
        .send({
          projectId,
          config: mockConfig,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/maestro/sync', () => {
    beforeEach(async () => {
      // First set config
      await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, config: mockConfig });
    });

    it('should sync registry from GitLab', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      const res = await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.widgetCount).toBe(3);
      expect(res.body.data.version).toBe('abc123');
    });

    it('should return error when config not found', async () => {
      const res = await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId: 'unknown-project' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('not found');
    });

    it('should handle GitLab API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Artifact not found',
      });

      const res = await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('404');
    });
  });

  describe('GET /api/maestro/registry', () => {
    beforeEach(async () => {
      // Set config and sync registry
      await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, config: mockConfig });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });
    });

    it('should return registry status', async () => {
      const res = await request(app)
        .get(`/api/maestro/registry?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cached).toBe(true);
      expect(res.body.data.version).toBe('abc123');
      expect(res.body.data.widgetCount).toBe(3);
    });

    it('should return uncached for unknown project', async () => {
      const res = await request(app)
        .get('/api/maestro/registry?projectId=unknown')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cached).toBe(false);
    });
  });

  describe('GET /api/maestro/registry/widgets', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, config: mockConfig });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });
    });

    it('should list all widgets', async () => {
      const res = await request(app)
        .get(`/api/maestro/registry/widgets?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].eventName).toBe('Login');
    });

    it('should search widgets by query', async () => {
      const res = await request(app)
        .get(`/api/maestro/registry/widgets?projectId=${projectId}&query=Login`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((w: { eventName: string }) =>
        w.eventName.toLowerCase().includes('login')
      )).toBe(true);
    });
  });

  describe('POST /api/maestro/generate', () => {
    const mockGeneratedYaml = {
      name: 'user_login.yaml',
      yaml: `appId: com.bankbazaar.app
---
- launchApp:
    clearState: true
- tapOn:
    id: Login
- inputText: "9876543210"
- tapOn:
    id: LoginAttempt`,
      appId: 'com.bankbazaar.app',
      commands: ['launchApp', 'tapOn', 'inputText'],
      warnings: [],
    };

    beforeEach(async () => {
      await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, config: mockConfig });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });
    });

    it('should generate flow from test case', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const res = await request(app)
        .post('/api/maestro/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          inputMethod: 'test_case',
          testCase: {
            title: 'User Login',
            steps: [
              { order: 1, action: 'Open app', expected: 'Login shown' },
              { order: 2, action: 'Enter mobile', expected: 'Number entered' },
              { order: 3, action: 'Tap Login', expected: 'Dashboard shown' },
            ],
          },
          options: {
            appId: 'com.bankbazaar.app',
            projectId,
            includeAssertions: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('user_login.yaml');
      expect(res.body.data.yaml).toContain('appId: com.bankbazaar.app');
      expect(res.body.usage).toBeDefined();
      expect(res.body.usage.inputTokens).toBe(500);
    });

    it('should generate flow from description', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedYaml) }],
        usage: { input_tokens: 400, output_tokens: 180 },
      });

      const res = await request(app)
        .post('/api/maestro/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          inputMethod: 'description',
          description: 'Test user login with mobile number verification',
          options: {
            appId: 'com.bankbazaar.app',
            projectId,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.yaml).toBeDefined();
    });

    it('should require inputMethod', async () => {
      const res = await request(app)
        .post('/api/maestro/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Test',
          options: { appId: 'com.example.app', projectId },
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/maestro/edit', () => {
    const existingYaml = `appId: com.bankbazaar.app
---
- launchApp
- tapOn: "Login Button"`;

    const mockEditedYaml = {
      yaml: `appId: com.bankbazaar.app
---
- launchApp
- tapOn:
    id: Login`,
      changes: ['Changed text selector to id selector'],
      explanation: 'Used id selector for reliability',
      warnings: [],
    };

    beforeEach(async () => {
      await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, config: mockConfig });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });
    });

    it('should edit existing YAML flow', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockEditedYaml) }],
        usage: { input_tokens: 400, output_tokens: 200 },
      });

      const res = await request(app)
        .post('/api/maestro/edit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          existingYaml,
          instruction: 'Use id selector instead of text',
          projectId,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.yaml).toContain('id: Login');
      expect(res.body.data.changes).toHaveLength(1);
    });

    it('should accept error context', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockEditedYaml) }],
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const res = await request(app)
        .post('/api/maestro/edit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          existingYaml,
          instruction: 'Fix the failing selector',
          projectId,
          context: {
            errorMessage: 'Element not found: Login Button',
            failedCommand: 'tapOn: "Login Button"',
          },
        });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/maestro/validate', () => {
    it('should validate correct YAML', async () => {
      const res = await request(app)
        .post('/api/maestro/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          yaml: `appId: com.bankbazaar.app
---
- launchApp
- tapOn:
    id: Login`,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.errors).toHaveLength(0);
    });

    it('should report missing appId', async () => {
      const res = await request(app)
        .post('/api/maestro/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          yaml: `---
- launchApp`,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.errors).toContain('Missing appId in YAML header');
    });

    it('should warn about unknown commands', async () => {
      const res = await request(app)
        .post('/api/maestro/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          yaml: `appId: com.example.app
---
- launchApp
- unknownCommand: test`,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.warnings.some((w: string) => w.includes('Unknown command'))).toBe(true);
    });
  });

  describe('GET /api/maestro/commands', () => {
    it('should return list of Maestro commands', async () => {
      const res = await request(app)
        .get('/api/maestro/commands')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.find((c: { name: string }) => c.name === 'tapOn')).toBeDefined();
      expect(res.body.data.find((c: { name: string }) => c.name === 'launchApp')).toBeDefined();
    });
  });

  describe('DELETE /api/maestro/cache', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/maestro/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, config: mockConfig });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      });

      await request(app)
        .post('/api/maestro/sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId });
    });

    it('should clear cache for project', async () => {
      const res = await request(app)
        .delete(`/api/maestro/cache?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Cache cleared');

      // Verify cache is cleared
      const statusRes = await request(app)
        .get(`/api/maestro/registry?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusRes.body.data.cached).toBe(false);
    });
  });
});
