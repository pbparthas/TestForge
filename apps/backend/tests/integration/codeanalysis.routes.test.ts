/**
 * Code Analysis Agent Routes Integration Tests
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

describe('Code Analysis Agent Routes Integration', () => {
  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';

  // Sample code input for testing
  const sampleCodeInput = {
    files: [
      {
        path: 'src/services/auth.service.ts',
        content: `
export class AuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default';
  }

  async login(email: string, password: string): Promise<string> {
    const user = await this.findUser(email);
    if (!user) throw new Error('User not found');

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) throw new Error('Invalid password');

    return this.generateToken(user);
  }
}`,
        language: 'typescript',
      },
      {
        path: 'src/services/payment.service.ts',
        content: `
export class PaymentService {
  async processPayment(amount: number, currency: string): Promise<void> {
    const validated = this.validateAmount(amount);
    const converted = this.convertCurrency(amount, currency);
    await this.charge(converted);
  }
}`,
        language: 'typescript',
      },
    ],
    projectRoot: '/home/user/project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) {
        return { userId: 'admin-123', role: 'admin' };
      }
      if (token === userToken) {
        return { userId: 'user-456', role: 'user' };
      }
      throw new Error('Invalid token');
    });
    mockPrisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'admin-123') {
        return Promise.resolve({ id: 'admin-123', role: 'admin', isActive: true });
      }
      if (where.id === 'user-456') {
        return Promise.resolve({ id: 'user-456', role: 'user', isActive: true });
      }
      return Promise.resolve(null);
    });
    mockPrisma.aiUsage.create.mockResolvedValue({ id: 'usage-123' });
  });

  // ==========================================================================
  // POST /api/code-analysis/complexity - Analyze code complexity
  // ==========================================================================
  describe('POST /api/code-analysis/complexity', () => {
    const mockComplexityOutput = {
      summary: {
        averageCyclomaticComplexity: 8.5,
        averageCognitiveComplexity: 12.3,
        averageMaintainabilityIndex: 65.2,
        totalFiles: 2,
        totalFunctions: 5,
        complexFunctions: 2,
      },
      files: [
        {
          path: 'src/services/auth.service.ts',
          cyclomaticComplexity: 12,
          cognitiveComplexity: 18,
          maintainabilityIndex: 55,
          linesOfCode: 20,
          functions: [
            {
              name: 'login',
              cyclomaticComplexity: 8,
              cognitiveComplexity: 12,
              lineStart: 8,
              lineEnd: 18,
              issues: ['Multiple conditionals'],
            },
          ],
          overallRisk: 'high' as const,
        },
      ],
      hotspots: [
        {
          file: 'src/services/auth.service.ts',
          function: 'login',
          metric: 'cognitiveComplexity',
          value: 12,
          threshold: 10,
          recommendation: 'Simplify conditional logic',
        },
      ],
      trends: {
        improving: [],
        degrading: ['src/services/auth.service.ts'],
        stable: [],
      },
      recommendations: [
        'Refactor login method to reduce complexity',
        'Extract validation logic',
      ],
    };

    it('should analyze code complexity successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockComplexityOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.averageCyclomaticComplexity).toBe(8.5);
      expect(res.body.data.files).toHaveLength(1);
      expect(res.body.data.hotspots).toHaveLength(1);
      expect(res.body.usage).toBeDefined();
    });

    it('should analyze with custom thresholds', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockComplexityOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          input: sampleCodeInput,
          options: {
            cyclomaticThreshold: 5,
            cognitiveThreshold: 8,
            maintainabilityThreshold: 70,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
    });

    it('should filter by file patterns', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockComplexityOutput) }],
        usage: { input_tokens: 1500, output_tokens: 1000 },
      });

      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
          options: {
            includePatterns: ['**/services/**'],
            excludePatterns: ['**/*.test.ts'],
          },
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 when input is missing', async () => {
      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: { cyclomaticThreshold: 10 },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when files array is empty', async () => {
      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: { files: [] },
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/code-analysis/architecture - Analyze architecture
  // ==========================================================================
  describe('POST /api/code-analysis/architecture', () => {
    const mockArchitectureOutput = {
      summary: {
        totalModules: 3,
        totalDependencies: 8,
        avgCoupling: 2.5,
        circularDependencies: 1,
        layerViolations: 2,
        architectureScore: 72,
      },
      modules: [
        {
          name: 'AuthService',
          path: 'src/services/auth.service.ts',
          dependencies: ['UserRepository', 'JwtUtil'],
          dependents: ['AuthController'],
          coupling: 3,
          cohesion: 'high' as const,
          layer: 'service',
        },
      ],
      circularDependencies: [
        {
          cycle: ['AuthService', 'UserService', 'AuthService'],
          severity: 'high' as const,
          recommendation: 'Extract shared logic',
        },
      ],
      layerViolations: [
        {
          source: 'AuthController',
          target: 'UserRepository',
          sourceLayer: 'controller',
          targetLayer: 'repository',
          violation: 'Controller should not access repository',
          recommendation: 'Use service layer',
        },
      ],
      dependencyGraph: {
        nodes: ['AuthService', 'PaymentService'],
        edges: [
          { from: 'AuthService', to: 'JwtUtil', type: 'imports' as const },
        ],
      },
      recommendations: [
        'Break circular dependency',
        'Add service layer between controllers and repositories',
      ],
    };

    it('should analyze architecture successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockArchitectureOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2000 },
      });

      const res = await request(app)
        .post('/api/code-analysis/architecture')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalModules).toBe(3);
      expect(res.body.data.circularDependencies).toHaveLength(1);
      expect(res.body.data.layerViolations).toHaveLength(1);
      expect(res.body.usage).toBeDefined();
    });

    it('should analyze with custom layer definitions', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockArchitectureOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2000 },
      });

      const res = await request(app)
        .post('/api/code-analysis/architecture')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          input: sampleCodeInput,
          options: {
            layers: [
              { name: 'controller', patterns: ['**/controllers/**'] },
              { name: 'service', patterns: ['**/services/**'] },
              { name: 'repository', patterns: ['**/repositories/**'] },
            ],
            allowedDependencies: {
              controller: ['service'],
              service: ['repository'],
              repository: [],
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.modules).toBeDefined();
    });

    it('should detect circular dependencies', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockArchitectureOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/code-analysis/architecture')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.circularDependencies).toHaveLength(1);
      expect(res.body.data.circularDependencies[0].cycle).toContain('AuthService');
    });

    it('should return 400 when input is missing', async () => {
      const res = await request(app)
        .post('/api/code-analysis/architecture')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/code-analysis/architecture')
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/code-analysis/best-practices - Check best practices
  // ==========================================================================
  describe('POST /api/code-analysis/best-practices', () => {
    const mockBestPracticesOutput = {
      summary: {
        totalViolations: 5,
        criticalViolations: 1,
        warningViolations: 3,
        infoViolations: 1,
        overallScore: 75,
        categories: {
          SOLID: 70,
          DRY: 85,
          codeSmells: 72,
          naming: 90,
          security: 65,
        },
      },
      violations: [
        {
          id: 'SEC-001',
          rule: 'Hardcoded Secrets',
          severity: 'critical' as const,
          file: 'src/services/auth.service.ts',
          line: 6,
          message: 'Default secret should not be hardcoded',
          suggestion: 'Use environment variable validation',
          category: 'security' as const,
        },
        {
          id: 'SRP-001',
          rule: 'Single Responsibility Principle',
          severity: 'warning' as const,
          file: 'src/services/payment.service.ts',
          line: 2,
          message: 'Method does too many things',
          suggestion: 'Extract into smaller methods',
          category: 'SOLID' as const,
        },
      ],
      fileScores: [
        {
          path: 'src/services/auth.service.ts',
          score: 70,
          violations: 2,
          topIssue: 'Hardcoded default secret',
        },
      ],
      recommendations: [
        'Fix critical security issue first',
        'Apply SRP to payment service',
      ],
      patterns: {
        detected: ['Service Pattern'],
        suggested: ['Dependency Injection'],
      },
    };

    it('should check best practices successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockBestPracticesOutput) }],
        usage: { input_tokens: 2200, output_tokens: 1800 },
      });

      const res = await request(app)
        .post('/api/code-analysis/best-practices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalViolations).toBe(5);
      expect(res.body.data.violations).toHaveLength(2);
      expect(res.body.data.summary.categories.SOLID).toBe(70);
      expect(res.body.usage).toBeDefined();
    });

    it('should check with custom rules', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockBestPracticesOutput) }],
        usage: { input_tokens: 2200, output_tokens: 1800 },
      });

      const res = await request(app)
        .post('/api/code-analysis/best-practices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          input: sampleCodeInput,
          options: {
            enabledRules: ['SRP', 'OCP', 'DRY'],
            disabledRules: ['naming-convention'],
            customRules: [
              {
                id: 'CUSTOM-001',
                name: 'No console.log',
                pattern: 'console\\.log',
                message: 'Use logger',
                severity: 'warning',
              },
            ],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.violations).toBeDefined();
    });

    it('should identify SOLID violations', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockBestPracticesOutput) }],
        usage: { input_tokens: 2000, output_tokens: 1500 },
      });

      const res = await request(app)
        .post('/api/code-analysis/best-practices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(200);
      const solidViolations = res.body.data.violations.filter(
        (v: any) => v.category === 'SOLID'
      );
      expect(solidViolations.length).toBeGreaterThan(0);
    });

    it('should return 400 when input is missing', async () => {
      const res = await request(app)
        .post('/api/code-analysis/best-practices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/code-analysis/best-practices')
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/code-analysis/technical-debt - Score technical debt
  // ==========================================================================
  describe('POST /api/code-analysis/technical-debt', () => {
    const mockTechnicalDebtOutput = {
      summary: {
        totalDebtHours: 32.5,
        totalDebtCost: 3250,
        debtRatio: 8.5,
        debtGrade: 'B' as const,
        debtTrend: 'stable' as const,
        prioritizedItems: 5,
      },
      items: [
        {
          id: 'DEBT-001',
          type: 'security' as const,
          title: 'Hardcoded default secret',
          description: 'JWT_SECRET has fallback to hardcoded value',
          file: 'src/services/auth.service.ts',
          severity: 'critical' as const,
          effort: {
            hours: 1,
            complexity: 'trivial' as const,
            risk: 'none' as const,
          },
          impact: {
            maintainability: 'low' as const,
            testability: 'none' as const,
            performance: 'none' as const,
          },
          recommendation: 'Remove default value',
          priority: 1,
        },
        {
          id: 'DEBT-002',
          type: 'code_quality' as const,
          title: 'Complex method in PaymentService',
          description: 'processPayment has too many responsibilities',
          file: 'src/services/payment.service.ts',
          severity: 'medium' as const,
          effort: {
            hours: 4,
            complexity: 'low' as const,
            risk: 'low' as const,
          },
          impact: {
            maintainability: 'medium' as const,
            testability: 'medium' as const,
            performance: 'none' as const,
          },
          recommendation: 'Refactor into smaller methods',
          priority: 2,
        },
      ],
      categories: {
        architecture: { count: 0, hours: 0, percentage: 0 },
        code_quality: { count: 1, hours: 4, percentage: 12.3 },
        security: { count: 1, hours: 1, percentage: 3.1 },
        testing: { count: 0, hours: 0, percentage: 0 },
        documentation: { count: 0, hours: 0, percentage: 0 },
      },
      remediationPlan: {
        immediate: ['DEBT-001'],
        shortTerm: ['DEBT-002'],
        longTerm: [],
        totalEffort: {
          immediate: 1,
          shortTerm: 4,
          longTerm: 0,
        },
      },
      recommendations: [
        'Address security debt immediately',
        'Plan refactoring sprint for code quality',
      ],
      trends: {
        weekOverWeek: 2.1,
        monthOverMonth: 8.5,
        topGrowing: ['code_quality'],
      },
    };

    it('should score technical debt successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTechnicalDebtOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2200 },
      });

      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalDebtHours).toBe(32.5);
      expect(res.body.data.summary.debtGrade).toBe('B');
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.remediationPlan).toBeDefined();
      expect(res.body.usage).toBeDefined();
    });

    it('should score with custom cost rates', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTechnicalDebtOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2200 },
      });

      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          input: sampleCodeInput,
          options: {
            hourlyRate: 150,
            currency: 'USD',
            includeSeverities: ['critical', 'high', 'medium'],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalDebtCost).toBeDefined();
    });

    it('should provide remediation plan', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTechnicalDebtOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2200 },
      });

      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.remediationPlan.immediate).toContain('DEBT-001');
      expect(res.body.data.remediationPlan.shortTerm).toContain('DEBT-002');
    });

    it('should include trend analysis', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockTechnicalDebtOutput) }],
        usage: { input_tokens: 2500, output_tokens: 2200 },
      });

      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
          options: {
            historicalData: [
              { date: '2026-01-01', totalHours: 25 },
              { date: '2026-01-08', totalHours: 28 },
              { date: '2026-01-15', totalHours: 32 },
            ],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.trends).toBeDefined();
    });

    it('should return 400 when input is missing', async () => {
      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', 'Bearer bad_token')
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================
  describe('Error Handling', () => {
    it('should handle AI API errors gracefully for /complexity', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /architecture', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/code-analysis/architecture')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /best-practices', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Connection timeout'));

      const res = await request(app)
        .post('/api/code-analysis/best-practices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle AI API errors gracefully for /technical-debt', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Invalid API key'));

      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /complexity', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'This is not valid JSON { broken' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /architecture', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"incomplete": true' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/code-analysis/architecture')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /best-practices', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'invalid json here' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/code-analysis/best-practices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);

    it('should handle malformed JSON response from AI for /technical-debt', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"summary": ' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const res = await request(app)
        .post('/api/code-analysis/technical-debt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: sampleCodeInput,
        });

      expect(res.status).toBe(500);
    }, 20000);
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================
  describe('Input Validation', () => {
    it('should validate file path is required', async () => {
      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: {
            files: [
              {
                content: 'const x = 1;',
                language: 'typescript',
              },
            ],
          },
        });

      expect(res.status).toBe(400);
    });

    it('should validate file content is required', async () => {
      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: {
            files: [
              {
                path: 'src/test.ts',
                language: 'typescript',
              },
            ],
          },
        });

      expect(res.status).toBe(400);
    });

    it('should accept valid input structure', async () => {
      const mockOutput = {
        summary: {
          averageCyclomaticComplexity: 1,
          averageCognitiveComplexity: 1,
          averageMaintainabilityIndex: 100,
          totalFiles: 1,
          totalFunctions: 0,
          complexFunctions: 0,
        },
        files: [],
        hotspots: [],
        trends: { improving: [], degrading: [], stable: [] },
        recommendations: [],
      };

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockOutput) }],
        usage: { input_tokens: 500, output_tokens: 300 },
      });

      const res = await request(app)
        .post('/api/code-analysis/complexity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: {
            files: [
              {
                path: 'src/test.ts',
                content: 'const x = 1;',
                language: 'typescript',
              },
            ],
          },
        });

      expect(res.status).toBe(200);
    });
  });
});
