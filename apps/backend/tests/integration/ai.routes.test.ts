/**
 * AI Routes Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockPrisma, mockJwt, mockAnthropicCreate } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    aiUsage: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
  mockAnthropicCreate: vi.fn(),
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate };
  },
}));

import app from '../../src/app.js';

describe('AI Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const projectId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', role: 'admin', isActive: true });
    mockPrisma.aiUsage.create.mockResolvedValue({ id: 'usage-123' });
  });

  describe('POST /api/ai/test-weaver/generate', () => {
    it('should generate test cases from specification', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          testCases: [{
            title: 'Login with valid credentials',
            description: 'Verify user can login',
            preconditions: 'User exists',
            steps: [{ order: 1, action: 'Enter username', expected: 'Field populated' }],
            expectedResult: 'User logged in',
            priority: 'high',
            type: 'functional',
            tags: ['login'],
          }],
          summary: { total: 1, byPriority: { high: 1 }, byType: { functional: 1 } },
        })}],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const res = await request(app)
        .post('/api/ai/test-weaver/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          specification: 'User should be able to login with username and password',
          inputMethod: 'natural_language',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.testCases).toHaveLength(1);
      expect(res.body.data.testCases[0].title).toBe('Login with valid credentials');
    });
  });

  describe('POST /api/ai/script-smith/generate', () => {
    it('should generate script from test case', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          name: 'login.spec.ts',
          code: 'test("login", async ({ page }) => { await page.goto("/login"); });',
          language: 'typescript',
          framework: 'playwright',
        })}],
        usage: { input_tokens: 150, output_tokens: 250 },
      });

      const res = await request(app)
        .post('/api/ai/script-smith/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          inputMethod: 'test_case',
          testCase: {
            title: 'Login Test',
            steps: [
              { order: 1, action: 'Go to login page', expected: 'Login page displayed' },
              { order: 2, action: 'Enter credentials', expected: 'Fields populated' },
            ],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('login.spec.ts');
      expect(res.body.data.framework).toBe('playwright');
    });
  });

  describe('POST /api/ai/script-smith/edit', () => {
    it('should edit existing script', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          code: 'test("login", async ({ page }) => { await page.waitForSelector(".login-form"); });',
          changes: ['Added waitForSelector before interaction'],
          explanation: 'Added explicit wait to handle timing issues',
        })}],
        usage: { input_tokens: 200, output_tokens: 300 },
      });

      const res = await request(app)
        .post('/api/ai/script-smith/edit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          existingCode: 'test("login", async ({ page }) => { await page.click(".submit"); });',
          instruction: 'Add a wait before clicking submit',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.changes).toContain('Added waitForSelector before interaction');
    });
  });

  describe('GET /api/ai/usage', () => {
    it('should return paginated AI usage', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([
        { id: 'usage-1', agent: 'TestWeaver', costUsd: 0.001 },
      ]);
      mockPrisma.aiUsage.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/ai/usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
    });
  });

  describe('POST /api/ai/framework/analyze', () => {
    it('should analyze code for patterns', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          pageObjectSuggestions: [{ name: 'LoginPage', selectors: ['#login'], methods: ['login'], reason: 'Multiple interactions' }],
          codeSmells: [],
          bestPractices: [{ rule: 'Use role selectors', status: 'pass', details: 'Good' }],
          overallScore: 85,
        })}],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const res = await request(app)
        .post('/api/ai/framework/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, code: 'test("login", async ({ page }) => { await page.click("#login"); });', framework: 'playwright' });

      expect(res.status).toBe(200);
      expect(res.body.data.overallScore).toBe(85);
    });
  });

  describe('POST /api/ai/self-healing/diagnose', () => {
    it('should diagnose test failure', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          diagnosis: { type: 'selector', confidence: 90, explanation: 'Selector not found' },
          rootCause: 'Button ID changed',
          suggestedFixes: [{ description: 'Update selector', code: 'await page.click("#new-btn")', confidence: 95, autoApplicable: true }],
          preventionTips: ['Use data-testid'],
        })}],
        usage: { input_tokens: 150, output_tokens: 250 },
      });

      const res = await request(app)
        .post('/api/ai/self-healing/diagnose')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, errorMessage: 'Element not found', failedCode: 'await page.click("#old-btn");' });

      expect(res.status).toBe(200);
      expect(res.body.data.diagnosis.type).toBe('selector');
    });
  });

  describe('POST /api/ai/flow-pilot/generate', () => {
    it('should generate API tests', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          tests: [{ name: 'should create user', description: 'POST /users', code: 'test(...)', type: 'positive' }],
          setup: '// Setup code',
          helpers: [],
        })}],
        usage: { input_tokens: 100, output_tokens: 300 },
      });

      const res = await request(app)
        .post('/api/ai/flow-pilot/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, endpoint: { method: 'POST', path: '/users', description: 'Create user' } });

      expect(res.status).toBe(200);
      expect(res.body.data.tests).toHaveLength(1);
    });
  });

  describe('POST /api/ai/code-guardian/generate', () => {
    it('should generate unit tests', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          tests: [{ name: 'should add numbers', code: 'test(...)', covers: ['add'], type: 'happy-path' }],
          mocks: [],
          setup: '// imports',
          estimatedCoverage: 80,
        })}],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const res = await request(app)
        .post('/api/ai/code-guardian/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, code: 'function add(a, b) { return a + b; }', language: 'typescript' });

      expect(res.status).toBe(200);
      expect(res.body.data.estimatedCoverage).toBe(80);
    });
  });
});
