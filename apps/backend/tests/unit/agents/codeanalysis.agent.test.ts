/**
 * Code Analysis Agent Tests
 * Tests for analyzing code complexity, architecture, best practices, and technical debt
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Anthropic client - must be hoisted with vi.hoisted
const { mockAnthropicClient, mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockAnthropicClient: {
    messages: {
      create: vi.fn(),
    },
  },
}));

// Assign the mock function to the client
mockAnthropicClient.messages.create = mockCreate;

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => mockAnthropicClient),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import {
  CodeAnalysisAgent,
  CodeInput,
  ComplexityAnalysisOutput,
  ArchitectureAnalysisOutput,
  BestPracticesOutput,
  TechnicalDebtOutput,
  ComplexityOptions,
  ArchitectureOptions,
  BestPracticesOptions,
  TechnicalDebtOptions,
} from '../../../src/agents/codeanalysis.agent.js';

describe('CodeAnalysisAgent', () => {
  let agent: CodeAnalysisAgent;

  // Sample code inputs
  const sampleCodeInput: CodeInput = {
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

    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        console.log('Even iteration');
      } else if (i % 3 === 0) {
        console.log('Divisible by 3');
      } else if (i > 5) {
        console.log('Greater than 5');
      }
    }

    return this.generateToken(user);
  }

  private async findUser(email: string): Promise<any> {
    return { id: '1', email, passwordHash: 'hash' };
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return password === hash;
  }

  private generateToken(user: any): string {
    return 'token';
  }
}`,
        language: 'typescript',
      },
      {
        path: 'src/services/payment.service.ts',
        content: `
export class PaymentService {
  async processPayment(amount: number, currency: string): Promise<void> {
    // Long method with too many responsibilities
    const validated = this.validateAmount(amount);
    const converted = this.convertCurrency(amount, currency);
    const gateway = this.selectGateway();
    const result = await gateway.charge(converted);
    await this.sendReceipt(result);
    await this.updateLedger(result);
    await this.notifyUser(result);
  }

  private validateAmount(amount: number): boolean { return amount > 0; }
  private convertCurrency(amount: number, currency: string): number { return amount; }
  private selectGateway(): any { return { charge: async () => ({}) }; }
  private async sendReceipt(result: any): Promise<void> {}
  private async updateLedger(result: any): Promise<void> {}
  private async notifyUser(result: any): Promise<void> {}
}`,
        language: 'typescript',
      },
    ],
    projectRoot: '/home/user/project',
  };

  const simpleCodeInput: CodeInput = {
    files: [
      {
        path: 'src/utils/helpers.ts',
        content: `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}`,
        language: 'typescript',
      },
    ],
  };

  // Mock API response helper
  const createMockResponse = (content: string) => ({
    content: [{ type: 'text' as const, text: content }],
    usage: {
      input_tokens: 1500,
      output_tokens: 800,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new CodeAnalysisAgent();
  });

  // ============================================================================
  // analyzeComplexity() Tests
  // ============================================================================

  describe('analyzeComplexity()', () => {
    const mockComplexityOutput: ComplexityAnalysisOutput = {
      summary: {
        averageCyclomaticComplexity: 8.5,
        averageCognitiveComplexity: 12.3,
        averageMaintainabilityIndex: 65.2,
        totalFiles: 2,
        totalFunctions: 10,
        complexFunctions: 3,
      },
      files: [
        {
          path: 'src/services/auth.service.ts',
          cyclomaticComplexity: 12,
          cognitiveComplexity: 18,
          maintainabilityIndex: 55,
          linesOfCode: 40,
          functions: [
            {
              name: 'login',
              cyclomaticComplexity: 8,
              cognitiveComplexity: 12,
              lineStart: 8,
              lineEnd: 28,
              issues: ['Too many conditional branches', 'Nested if statements'],
            },
          ],
          overallRisk: 'high',
        },
        {
          path: 'src/services/payment.service.ts',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 7,
          maintainabilityIndex: 75,
          linesOfCode: 25,
          functions: [
            {
              name: 'processPayment',
              cyclomaticComplexity: 5,
              cognitiveComplexity: 7,
              lineStart: 2,
              lineEnd: 12,
              issues: ['Method does too many things'],
            },
          ],
          overallRisk: 'medium',
        },
      ],
      hotspots: [
        {
          file: 'src/services/auth.service.ts',
          function: 'login',
          metric: 'cognitiveComplexity',
          value: 12,
          threshold: 10,
          recommendation: 'Extract conditional logic into separate methods',
        },
      ],
      trends: {
        improving: [],
        degrading: ['src/services/auth.service.ts'],
        stable: ['src/services/payment.service.ts'],
      },
      recommendations: [
        'Refactor login method to reduce cognitive complexity',
        'Extract authentication logic into smaller units',
        'Consider using early returns to flatten nesting',
      ],
    };

    it('should analyze code complexity successfully', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const result = await agent.analyzeComplexity(sampleCodeInput);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.averageCyclomaticComplexity).toBe(8.5);
      expect(result.data.summary.averageCognitiveComplexity).toBe(12.3);
      expect(result.data.summary.totalFiles).toBe(2);
      expect(result.data.files).toHaveLength(2);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should identify complex functions', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const result = await agent.analyzeComplexity(sampleCodeInput);

      expect(result.data.summary.complexFunctions).toBe(3);
      expect(result.data.files[0].functions[0].cyclomaticComplexity).toBe(8);
      expect(result.data.files[0].functions[0].issues).toContain('Too many conditional branches');
    });

    it('should calculate maintainability index', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const result = await agent.analyzeComplexity(sampleCodeInput);

      expect(result.data.summary.averageMaintainabilityIndex).toBe(65.2);
      expect(result.data.files[0].maintainabilityIndex).toBe(55);
    });

    it('should identify hotspots exceeding thresholds', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const result = await agent.analyzeComplexity(sampleCodeInput);

      expect(result.data.hotspots).toHaveLength(1);
      expect(result.data.hotspots[0].file).toBe('src/services/auth.service.ts');
      expect(result.data.hotspots[0].value).toBeGreaterThan(result.data.hotspots[0].threshold);
    });

    it('should handle custom complexity thresholds', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const options: ComplexityOptions = {
        cyclomaticThreshold: 5,
        cognitiveThreshold: 8,
        maintainabilityThreshold: 70,
      };

      const result = await agent.analyzeComplexity(sampleCodeInput, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('THRESHOLDS');
    });

    it('should handle empty file array', async () => {
      const emptyOutput: ComplexityAnalysisOutput = {
        summary: {
          averageCyclomaticComplexity: 0,
          averageCognitiveComplexity: 0,
          averageMaintainabilityIndex: 100,
          totalFiles: 0,
          totalFunctions: 0,
          complexFunctions: 0,
        },
        files: [],
        hotspots: [],
        trends: { improving: [], degrading: [], stable: [] },
        recommendations: ['No code to analyze'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(emptyOutput)));

      const result = await agent.analyzeComplexity({ files: [] });

      expect(result.data.files).toEqual([]);
      expect(result.data.summary.totalFiles).toBe(0);
    });

    it('should calculate per-file risk levels', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const result = await agent.analyzeComplexity(sampleCodeInput);

      expect(result.data.files[0].overallRisk).toBe('high');
      expect(result.data.files[1].overallRisk).toBe('medium');
    });

    it('should include usage metrics in response', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const result = await agent.analyzeComplexity(sampleCodeInput);

      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBe(1500);
      expect(result.usage.outputTokens).toBe(800);
      expect(result.usage.model).toBeDefined();
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should filter by file patterns when specified', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockComplexityOutput)));

      const options: ComplexityOptions = {
        includePatterns: ['**/services/**'],
        excludePatterns: ['**/*.test.ts'],
      };

      const result = await agent.analyzeComplexity(sampleCodeInput, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('INCLUDE PATTERNS');
      expect(userMessage.content).toContain('EXCLUDE PATTERNS');
    });
  });

  // ============================================================================
  // analyzeArchitecture() Tests
  // ============================================================================

  describe('analyzeArchitecture()', () => {
    const mockArchitectureOutput: ArchitectureAnalysisOutput = {
      summary: {
        totalModules: 5,
        totalDependencies: 12,
        avgCoupling: 3.2,
        circularDependencies: 1,
        layerViolations: 2,
        architectureScore: 68,
      },
      modules: [
        {
          name: 'AuthService',
          path: 'src/services/auth.service.ts',
          dependencies: ['UserRepository', 'JwtUtil', 'Logger'],
          dependents: ['AuthController', 'MiddlewareAuth'],
          coupling: 5,
          cohesion: 'high',
          layer: 'service',
        },
        {
          name: 'PaymentService',
          path: 'src/services/payment.service.ts',
          dependencies: ['PaymentGateway', 'Ledger', 'Notifier'],
          dependents: ['PaymentController'],
          coupling: 4,
          cohesion: 'medium',
          layer: 'service',
        },
      ],
      circularDependencies: [
        {
          cycle: ['AuthService', 'UserService', 'AuthService'],
          severity: 'high',
          recommendation: 'Extract shared logic into a separate module',
        },
      ],
      layerViolations: [
        {
          source: 'AuthController',
          target: 'UserRepository',
          sourceLayer: 'controller',
          targetLayer: 'repository',
          violation: 'Controller should not access repository directly',
          recommendation: 'Use service layer as intermediary',
        },
      ],
      dependencyGraph: {
        nodes: ['AuthService', 'PaymentService', 'UserRepository'],
        edges: [
          { from: 'AuthService', to: 'UserRepository', type: 'imports' },
          { from: 'AuthService', to: 'JwtUtil', type: 'imports' },
        ],
      },
      recommendations: [
        'Break circular dependency between AuthService and UserService',
        'Add service layer between controllers and repositories',
        'Consider dependency injection for better testability',
      ],
    };

    it('should analyze architecture dependencies', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockArchitectureOutput)));

      const result = await agent.analyzeArchitecture(sampleCodeInput);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalModules).toBe(5);
      expect(result.data.summary.totalDependencies).toBe(12);
      expect(result.data.modules).toHaveLength(2);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should detect circular dependencies', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockArchitectureOutput)));

      const result = await agent.analyzeArchitecture(sampleCodeInput);

      expect(result.data.circularDependencies).toHaveLength(1);
      expect(result.data.circularDependencies[0].cycle).toContain('AuthService');
      expect(result.data.circularDependencies[0].severity).toBe('high');
    });

    it('should identify layer violations', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockArchitectureOutput)));

      const result = await agent.analyzeArchitecture(sampleCodeInput);

      expect(result.data.layerViolations).toHaveLength(1);
      expect(result.data.layerViolations[0].source).toBe('AuthController');
      expect(result.data.layerViolations[0].targetLayer).toBe('repository');
    });

    it('should calculate coupling metrics per module', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockArchitectureOutput)));

      const result = await agent.analyzeArchitecture(sampleCodeInput);

      expect(result.data.modules[0].coupling).toBe(5);
      expect(result.data.modules[0].dependencies).toContain('UserRepository');
    });

    it('should generate dependency graph', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockArchitectureOutput)));

      const result = await agent.analyzeArchitecture(sampleCodeInput);

      expect(result.data.dependencyGraph).toBeDefined();
      expect(result.data.dependencyGraph.nodes).toContain('AuthService');
      expect(result.data.dependencyGraph.edges.length).toBeGreaterThan(0);
    });

    it('should handle custom layer definitions', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockArchitectureOutput)));

      const options: ArchitectureOptions = {
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
      };

      const result = await agent.analyzeArchitecture(sampleCodeInput, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('LAYER DEFINITIONS');
      expect(userMessage.content).toContain('ALLOWED DEPENDENCIES');
    });

    it('should calculate architecture score', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockArchitectureOutput)));

      const result = await agent.analyzeArchitecture(sampleCodeInput);

      expect(result.data.summary.architectureScore).toBe(68);
    });

    it('should handle single file input', async () => {
      const singleFileOutput: ArchitectureAnalysisOutput = {
        summary: {
          totalModules: 1,
          totalDependencies: 0,
          avgCoupling: 0,
          circularDependencies: 0,
          layerViolations: 0,
          architectureScore: 100,
        },
        modules: [
          {
            name: 'helpers',
            path: 'src/utils/helpers.ts',
            dependencies: [],
            dependents: [],
            coupling: 0,
            cohesion: 'high',
            layer: 'util',
          },
        ],
        circularDependencies: [],
        layerViolations: [],
        dependencyGraph: { nodes: ['helpers'], edges: [] },
        recommendations: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(singleFileOutput)));

      const result = await agent.analyzeArchitecture(simpleCodeInput);

      expect(result.data.modules).toHaveLength(1);
      expect(result.data.circularDependencies).toEqual([]);
      expect(result.data.summary.architectureScore).toBe(100);
    });
  });

  // ============================================================================
  // checkBestPractices() Tests
  // ============================================================================

  describe('checkBestPractices()', () => {
    const mockBestPracticesOutput: BestPracticesOutput = {
      summary: {
        totalViolations: 8,
        criticalViolations: 2,
        warningViolations: 4,
        infoViolations: 2,
        overallScore: 72,
        categories: {
          SOLID: 65,
          DRY: 80,
          codeSmells: 70,
          naming: 85,
          security: 60,
        },
      },
      violations: [
        {
          id: 'SRP-001',
          rule: 'Single Responsibility Principle',
          severity: 'critical',
          file: 'src/services/payment.service.ts',
          line: 2,
          message: 'Method processPayment has too many responsibilities',
          suggestion: 'Extract validation, currency conversion, and notification into separate services',
          category: 'SOLID',
        },
        {
          id: 'SEC-001',
          rule: 'Hardcoded Secrets',
          severity: 'critical',
          file: 'src/services/auth.service.ts',
          line: 6,
          message: 'Default secret value should not be hardcoded',
          suggestion: 'Use environment variable validation or throw error if missing',
          category: 'security',
        },
        {
          id: 'DRY-001',
          rule: 'Don\'t Repeat Yourself',
          severity: 'warning',
          file: 'src/services/auth.service.ts',
          line: 15,
          message: 'Console.log statements repeated in loop',
          suggestion: 'Extract logging into a helper function',
          category: 'DRY',
        },
        {
          id: 'SMELL-001',
          rule: 'Long Method',
          severity: 'warning',
          file: 'src/services/auth.service.ts',
          line: 8,
          message: 'Method login exceeds recommended length',
          suggestion: 'Break down into smaller methods',
          category: 'codeSmells',
        },
      ],
      fileScores: [
        {
          path: 'src/services/auth.service.ts',
          score: 65,
          violations: 3,
          topIssue: 'Hardcoded default secret',
        },
        {
          path: 'src/services/payment.service.ts',
          score: 70,
          violations: 1,
          topIssue: 'SRP violation in processPayment',
        },
      ],
      recommendations: [
        'Address critical security issue in auth.service.ts',
        'Refactor processPayment to follow SRP',
        'Remove console.log statements or use proper logger',
      ],
      patterns: {
        detected: ['Service Pattern', 'Class-based modules'],
        suggested: ['Dependency Injection', 'Repository Pattern'],
      },
    };

    it('should check best practices successfully', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalViolations).toBe(8);
      expect(result.data.violations).toBeDefined();
      expect(result.data.violations.length).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should identify SOLID violations', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      const solidViolations = result.data.violations.filter(v => v.category === 'SOLID');
      expect(solidViolations.length).toBeGreaterThan(0);
      expect(solidViolations[0].rule).toContain('Single Responsibility');
    });

    it('should detect DRY violations', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      const dryViolations = result.data.violations.filter(v => v.category === 'DRY');
      expect(dryViolations.length).toBeGreaterThan(0);
    });

    it('should identify code smells', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      const codeSmells = result.data.violations.filter(v => v.category === 'codeSmells');
      expect(codeSmells.length).toBeGreaterThan(0);
    });

    it('should categorize violations by severity', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      expect(result.data.summary.criticalViolations).toBe(2);
      expect(result.data.summary.warningViolations).toBe(4);
      expect(result.data.summary.infoViolations).toBe(2);
    });

    it('should calculate overall score', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      expect(result.data.summary.overallScore).toBe(72);
      expect(result.data.summary.categories).toBeDefined();
      expect(result.data.summary.categories.SOLID).toBe(65);
    });

    it('should handle custom rules', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const options: BestPracticesOptions = {
        enabledRules: ['SRP', 'OCP', 'LSP', 'ISP', 'DIP', 'DRY'],
        disabledRules: ['naming-convention'],
        customRules: [
          {
            id: 'CUSTOM-001',
            name: 'No console.log',
            pattern: 'console\\.log',
            message: 'Use logger instead of console.log',
            severity: 'warning',
          },
        ],
      };

      const result = await agent.checkBestPractices(sampleCodeInput, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('ENABLED RULES');
      expect(userMessage.content).toContain('CUSTOM RULES');
    });

    it('should provide per-file scores', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      expect(result.data.fileScores).toHaveLength(2);
      expect(result.data.fileScores[0].score).toBe(65);
      expect(result.data.fileScores[0].violations).toBe(3);
    });

    it('should suggest patterns', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockBestPracticesOutput)));

      const result = await agent.checkBestPractices(sampleCodeInput);

      expect(result.data.patterns).toBeDefined();
      expect(result.data.patterns.detected).toContain('Service Pattern');
      expect(result.data.patterns.suggested).toContain('Dependency Injection');
    });

    it('should handle clean code with no violations', async () => {
      const cleanOutput: BestPracticesOutput = {
        summary: {
          totalViolations: 0,
          criticalViolations: 0,
          warningViolations: 0,
          infoViolations: 0,
          overallScore: 100,
          categories: {
            SOLID: 100,
            DRY: 100,
            codeSmells: 100,
            naming: 100,
            security: 100,
          },
        },
        violations: [],
        fileScores: [
          {
            path: 'src/utils/helpers.ts',
            score: 100,
            violations: 0,
            topIssue: null,
          },
        ],
        recommendations: ['Code follows all best practices'],
        patterns: {
          detected: ['Utility Functions'],
          suggested: [],
        },
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(cleanOutput)));

      const result = await agent.checkBestPractices(simpleCodeInput);

      expect(result.data.violations).toEqual([]);
      expect(result.data.summary.overallScore).toBe(100);
    });
  });

  // ============================================================================
  // scoreTechnicalDebt() Tests
  // ============================================================================

  describe('scoreTechnicalDebt()', () => {
    const mockTechnicalDebtOutput: TechnicalDebtOutput = {
      summary: {
        totalDebtHours: 45.5,
        totalDebtCost: 4550,
        debtRatio: 12.5,
        debtGrade: 'C',
        debtTrend: 'increasing',
        prioritizedItems: 8,
      },
      items: [
        {
          id: 'DEBT-001',
          type: 'architecture',
          title: 'Circular dependency between Auth and User services',
          description: 'AuthService and UserService have bidirectional dependencies creating tight coupling',
          file: 'src/services/auth.service.ts',
          severity: 'high',
          effort: {
            hours: 8,
            complexity: 'medium',
            risk: 'low',
          },
          impact: {
            maintainability: 'high',
            testability: 'high',
            performance: 'low',
          },
          recommendation: 'Extract shared logic into a common module or use events',
          priority: 1,
        },
        {
          id: 'DEBT-002',
          type: 'code_quality',
          title: 'Complex authentication method',
          description: 'login() method has high cyclomatic complexity and poor readability',
          file: 'src/services/auth.service.ts',
          severity: 'medium',
          effort: {
            hours: 4,
            complexity: 'low',
            risk: 'low',
          },
          impact: {
            maintainability: 'medium',
            testability: 'medium',
            performance: 'none',
          },
          recommendation: 'Refactor into smaller, focused methods',
          priority: 2,
        },
        {
          id: 'DEBT-003',
          type: 'security',
          title: 'Hardcoded default secret',
          description: 'JWT_SECRET has fallback to hardcoded value',
          file: 'src/services/auth.service.ts',
          severity: 'critical',
          effort: {
            hours: 1,
            complexity: 'trivial',
            risk: 'none',
          },
          impact: {
            maintainability: 'low',
            testability: 'none',
            performance: 'none',
          },
          recommendation: 'Remove default value, throw error if env var missing',
          priority: 1,
        },
      ],
      categories: {
        architecture: { count: 1, hours: 8, percentage: 17.6 },
        code_quality: { count: 1, hours: 4, percentage: 8.8 },
        security: { count: 1, hours: 1, percentage: 2.2 },
        testing: { count: 0, hours: 0, percentage: 0 },
        documentation: { count: 0, hours: 0, percentage: 0 },
      },
      remediationPlan: {
        immediate: ['DEBT-003'],
        shortTerm: ['DEBT-001'],
        longTerm: ['DEBT-002'],
        totalEffort: {
          immediate: 1,
          shortTerm: 8,
          longTerm: 4,
        },
      },
      recommendations: [
        'Address security debt immediately (DEBT-003)',
        'Plan sprint to resolve architecture issues',
        'Include refactoring in regular development cycles',
      ],
      trends: {
        weekOverWeek: 5.2,
        monthOverMonth: 15.8,
        topGrowing: ['code_quality', 'architecture'],
      },
    };

    it('should score technical debt successfully', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const result = await agent.scoreTechnicalDebt(sampleCodeInput);

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalDebtHours).toBe(45.5);
      expect(result.data.summary.debtGrade).toBe('C');
      expect(result.data.items).toBeDefined();
      expect(result.data.items.length).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should calculate debt cost', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const result = await agent.scoreTechnicalDebt(sampleCodeInput);

      expect(result.data.summary.totalDebtCost).toBe(4550);
      expect(result.data.summary.debtRatio).toBe(12.5);
    });

    it('should prioritize debt items', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const result = await agent.scoreTechnicalDebt(sampleCodeInput);

      expect(result.data.items[0].priority).toBe(1);
      expect(result.data.items[2].severity).toBe('critical');
    });

    it('should estimate remediation effort', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const result = await agent.scoreTechnicalDebt(sampleCodeInput);

      expect(result.data.items[0].effort.hours).toBe(8);
      expect(result.data.items[0].effort.complexity).toBe('medium');
      expect(result.data.items[0].effort.risk).toBe('low');
    });

    it('should categorize debt by type', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const result = await agent.scoreTechnicalDebt(sampleCodeInput);

      expect(result.data.categories).toBeDefined();
      expect(result.data.categories.architecture.count).toBe(1);
      expect(result.data.categories.security.hours).toBe(1);
    });

    it('should provide remediation plan', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const result = await agent.scoreTechnicalDebt(sampleCodeInput);

      expect(result.data.remediationPlan).toBeDefined();
      expect(result.data.remediationPlan.immediate).toContain('DEBT-003');
      expect(result.data.remediationPlan.shortTerm).toContain('DEBT-001');
      expect(result.data.remediationPlan.longTerm).toContain('DEBT-002');
    });

    it('should track debt trends', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const result = await agent.scoreTechnicalDebt(sampleCodeInput);

      expect(result.data.summary.debtTrend).toBe('increasing');
      expect(result.data.trends.weekOverWeek).toBe(5.2);
      expect(result.data.trends.topGrowing).toContain('code_quality');
    });

    it('should handle custom cost rates', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const options: TechnicalDebtOptions = {
        hourlyRate: 150,
        currency: 'USD',
        includeSeverities: ['critical', 'high', 'medium'],
      };

      const result = await agent.scoreTechnicalDebt(sampleCodeInput, options);

      expect(result.data).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('HOURLY RATE');
      expect(userMessage.content).toContain('150');
    });

    it('should handle historical data for trend analysis', async () => {
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockTechnicalDebtOutput)));

      const options: TechnicalDebtOptions = {
        historicalData: [
          { date: '2026-01-01', totalHours: 30 },
          { date: '2026-01-08', totalHours: 35 },
          { date: '2026-01-15', totalHours: 42 },
        ],
      };

      const result = await agent.scoreTechnicalDebt(sampleCodeInput, options);

      expect(result.data.trends).toBeDefined();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage.content).toContain('HISTORICAL DATA');
    });

    it('should handle code with no technical debt', async () => {
      const noDebtOutput: TechnicalDebtOutput = {
        summary: {
          totalDebtHours: 0,
          totalDebtCost: 0,
          debtRatio: 0,
          debtGrade: 'A',
          debtTrend: 'stable',
          prioritizedItems: 0,
        },
        items: [],
        categories: {
          architecture: { count: 0, hours: 0, percentage: 0 },
          code_quality: { count: 0, hours: 0, percentage: 0 },
          security: { count: 0, hours: 0, percentage: 0 },
          testing: { count: 0, hours: 0, percentage: 0 },
          documentation: { count: 0, hours: 0, percentage: 0 },
        },
        remediationPlan: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          totalEffort: { immediate: 0, shortTerm: 0, longTerm: 0 },
        },
        recommendations: ['Codebase is in excellent shape - maintain current practices'],
        trends: {
          weekOverWeek: 0,
          monthOverMonth: 0,
          topGrowing: [],
        },
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(noDebtOutput)));

      const result = await agent.scoreTechnicalDebt(simpleCodeInput);

      expect(result.data.items).toEqual([]);
      expect(result.data.summary.debtGrade).toBe('A');
      expect(result.data.summary.totalDebtHours).toBe(0);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should retry on transient failures', async () => {
      const retryAgent = new CodeAnalysisAgent({ maxRetries: 2 });

      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      const mockOutput: ComplexityAnalysisOutput = {
        summary: {
          averageCyclomaticComplexity: 1,
          averageCognitiveComplexity: 1,
          averageMaintainabilityIndex: 100,
          totalFiles: 1,
          totalFunctions: 1,
          complexFunctions: 0,
        },
        files: [],
        hotspots: [],
        trends: { improving: [], degrading: [], stable: [] },
        recommendations: [],
      };

      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockOutput)));

      const result = await retryAgent.analyzeComplexity(simpleCodeInput);

      expect(result.data.summary).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledTimes(1);

      delaySpy.mockRestore();
    });

    it('should fail after max retries', async () => {
      const retryAgent = new CodeAnalysisAgent({ maxRetries: 3 });

      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      mockCreate.mockRejectedValue(new Error('Persistent API error'));

      await expect(retryAgent.analyzeComplexity(simpleCodeInput))
        .rejects.toThrow('Persistent API error');

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2);

      delaySpy.mockRestore();
    });

    it('should handle malformed JSON response', async () => {
      const noRetryAgent = new CodeAnalysisAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue(createMockResponse('This is not valid JSON at all'));

      await expect(noRetryAgent.analyzeComplexity(simpleCodeInput))
        .rejects.toThrow('Failed to parse JSON response');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockOutput: ComplexityAnalysisOutput = {
        summary: {
          averageCyclomaticComplexity: 1,
          averageCognitiveComplexity: 1,
          averageMaintainabilityIndex: 100,
          totalFiles: 1,
          totalFunctions: 1,
          complexFunctions: 0,
        },
        files: [],
        hotspots: [],
        trends: { improving: [], degrading: [], stable: [] },
        recommendations: [],
      };

      const wrappedJson = '```json\n' + JSON.stringify(mockOutput) + '\n```';

      mockCreate.mockResolvedValue(createMockResponse(wrappedJson));

      const result = await agent.analyzeComplexity(simpleCodeInput);

      expect(result.data.summary).toBeDefined();
    });

    it('should handle empty API response', async () => {
      const noRetryAgent = new CodeAnalysisAgent({ maxRetries: 1 });

      mockCreate.mockResolvedValue({
        content: [],
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      });

      await expect(noRetryAgent.analyzeComplexity(simpleCodeInput))
        .rejects.toThrow();
    });

    it('should handle rate limiting errors', async () => {
      const retryAgent = new CodeAnalysisAgent({ maxRetries: 2 });

      const delaySpy = vi.spyOn(retryAgent as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);

      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as Error & { status: number }).status = 429;

      mockCreate.mockRejectedValue(rateLimitError);

      await expect(retryAgent.analyzeComplexity(simpleCodeInput))
        .rejects.toThrow('Rate limit exceeded');

      expect(mockCreate).toHaveBeenCalledTimes(2);

      delaySpy.mockRestore();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultAgent = new CodeAnalysisAgent();
      expect(defaultAgent).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customAgent = new CodeAnalysisAgent({
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 8192,
        temperature: 0.5,
        maxRetries: 5,
      });
      expect(customAgent).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle very large files', async () => {
      const largeFileInput: CodeInput = {
        files: [
          {
            path: 'src/large-file.ts',
            content: 'function a() {}\n'.repeat(1000),
            language: 'typescript',
          },
        ],
      };

      const mockOutput: ComplexityAnalysisOutput = {
        summary: {
          averageCyclomaticComplexity: 1,
          averageCognitiveComplexity: 1,
          averageMaintainabilityIndex: 95,
          totalFiles: 1,
          totalFunctions: 1000,
          complexFunctions: 0,
        },
        files: [],
        hotspots: [],
        trends: { improving: [], degrading: [], stable: [] },
        recommendations: ['Consider splitting large files'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockOutput)));

      const result = await agent.analyzeComplexity(largeFileInput);

      expect(result.data.summary.totalFunctions).toBe(1000);
    });

    it('should handle multiple languages', async () => {
      const multiLangInput: CodeInput = {
        files: [
          { path: 'src/main.ts', content: 'const x = 1;', language: 'typescript' },
          { path: 'src/utils.js', content: 'const y = 2;', language: 'javascript' },
          { path: 'src/helpers.py', content: 'x = 1', language: 'python' },
        ],
      };

      const mockOutput: ComplexityAnalysisOutput = {
        summary: {
          averageCyclomaticComplexity: 1,
          averageCognitiveComplexity: 1,
          averageMaintainabilityIndex: 100,
          totalFiles: 3,
          totalFunctions: 0,
          complexFunctions: 0,
        },
        files: [],
        hotspots: [],
        trends: { improving: [], degrading: [], stable: [] },
        recommendations: [],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockOutput)));

      const result = await agent.analyzeComplexity(multiLangInput);

      expect(result.data.summary.totalFiles).toBe(3);
    });

    it('should handle files without content', async () => {
      const emptyContentInput: CodeInput = {
        files: [
          { path: 'src/empty.ts', content: '', language: 'typescript' },
        ],
      };

      const mockOutput: ComplexityAnalysisOutput = {
        summary: {
          averageCyclomaticComplexity: 0,
          averageCognitiveComplexity: 0,
          averageMaintainabilityIndex: 100,
          totalFiles: 1,
          totalFunctions: 0,
          complexFunctions: 0,
        },
        files: [
          {
            path: 'src/empty.ts',
            cyclomaticComplexity: 0,
            cognitiveComplexity: 0,
            maintainabilityIndex: 100,
            linesOfCode: 0,
            functions: [],
            overallRisk: 'low',
          },
        ],
        hotspots: [],
        trends: { improving: [], degrading: [], stable: [] },
        recommendations: ['Empty file detected'],
      };

      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(mockOutput)));

      const result = await agent.analyzeComplexity(emptyContentInput);

      expect(result.data.files[0].linesOfCode).toBe(0);
      expect(result.data.files[0].overallRisk).toBe('low');
    });
  });
});
