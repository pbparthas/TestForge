/**
 * TestPilot Routes Integration Tests (TDD - RED phase)
 * Sprint 12: Workflow orchestration API endpoints
 *
 * Tests for:
 * - GET /api/testpilot/workflows - List available workflows
 * - POST /api/testpilot/workflows - Create custom workflow
 * - GET /api/testpilot/workflows/:id - Get workflow details
 * - POST /api/testpilot/execute - Execute a workflow
 * - GET /api/testpilot/executions/:id - Get execution status
 * - POST /api/testpilot/executions/:id/cancel - Cancel execution
 * - POST /api/testpilot/estimate - Estimate workflow cost
 * - Authentication and authorization
 * - Validation and error responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// ============================================================================
// Mock Setup - Must be hoisted
// ============================================================================

const { mockPrisma, mockJwt, mockOrchestratorService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    workflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workflowExecution: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    aiUsage: { create: vi.fn() },
  },
  mockJwt: { sign: vi.fn(), verify: vi.fn() },
  mockOrchestratorService: {
    executeWorkflow: vi.fn(),
    executeCustomWorkflow: vi.fn(),
    createCustomWorkflow: vi.fn(),
    getWorkflowStatus: vi.fn(),
    cancelWorkflow: vi.fn(),
    estimateCost: vi.fn(),
    listWorkflows: vi.fn(),
    getWorkflowDefinition: vi.fn(),
  },
}));

vi.mock('../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));
vi.mock('../../src/services/testpilot.orchestrator.service.js', () => ({
  TestPilotOrchestratorService: vi.fn().mockImplementation(() => mockOrchestratorService),
  testPilotOrchestratorService: mockOrchestratorService,
}));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import app from '../../src/app.js';

// ============================================================================
// Test Data
// ============================================================================

const projectId = '11111111-1111-1111-1111-111111111111';
const workflowId = '22222222-2222-2222-2222-222222222222';
const executionId = '33333333-3333-3333-3333-333333333333';
const adminToken = 'admin_test_token';
const userToken = 'user_test_token';

const mockPredefinedWorkflows = [
  {
    id: 'full-test-suite',
    name: 'Full Test Suite',
    description: 'Generate test cases, scripts, and unit tests',
    agents: ['TestWeaver', 'ScriptSmith', 'CodeGuardian'],
    isPredefined: true,
  },
  {
    id: 'visual-regression-flow',
    name: 'Visual Regression Flow',
    description: 'Analyze visual changes and detect patterns',
    agents: ['VisualAnalysis', 'BugPattern'],
    isPredefined: true,
  },
  {
    id: 'api-test-flow',
    name: 'API Test Flow',
    description: 'Generate API tests from OpenAPI spec',
    agents: ['FlowPilot', 'CodeGuardian'],
    isPredefined: true,
  },
  {
    id: 'code-quality-audit',
    name: 'Code Quality Audit',
    description: 'Analyze code quality and evolve tests',
    agents: ['CodeAnalysis', 'TestEvolution'],
    isPredefined: true,
  },
];

const mockCustomWorkflow = {
  id: workflowId,
  name: 'Custom Workflow',
  description: 'A custom workflow',
  steps: [
    {
      id: 'step-1',
      type: 'agent',
      agent: 'TestWeaver',
      operation: 'generate',
      input: { specification: '${input.specification}' },
    },
  ],
  createdById: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockExecution = {
  id: executionId,
  workflowId: 'full-test-suite',
  status: 'completed',
  input: { specification: 'Test spec', projectId },
  output: {
    testWeaver: { testCases: [{ title: 'Test 1' }] },
    scriptSmith: { name: 'test.spec.ts' },
    codeGuardian: { tests: [] },
  },
  steps: [
    { id: 'step-1', status: 'completed', agent: 'TestWeaver' },
    { id: 'step-2', status: 'completed', agent: 'ScriptSmith' },
    { id: 'step-3', status: 'completed', agent: 'CodeGuardian' },
  ],
  totalCostUsd: 0.045,
  startedAt: new Date('2025-01-01T10:00:00Z'),
  completedAt: new Date('2025-01-01T10:00:30Z'),
  error: null,
  createdAt: new Date(),
};

const mockCostEstimate = {
  estimatedCostUsd: 0.05,
  estimatedTokens: { input: 3000, output: 1500 },
  breakdown: [
    { stepId: 'step-1', agent: 'TestWeaver', estimatedCostUsd: 0.02, estimatedTokens: 1500 },
    { stepId: 'step-2', agent: 'ScriptSmith', estimatedCostUsd: 0.02, estimatedTokens: 1500 },
    { stepId: 'step-3', agent: 'CodeGuardian', estimatedCostUsd: 0.01, estimatedTokens: 1000 },
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe('TestPilot Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'admin' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      role: 'admin',
      isActive: true,
    });
  });

  // ==========================================================================
  // GET /api/testpilot/workflows - List Workflows
  // ==========================================================================

  describe('GET /api/testpilot/workflows', () => {
    it('should return list of all workflows', async () => {
      mockOrchestratorService.listWorkflows.mockResolvedValue({
        predefined: mockPredefinedWorkflows,
        custom: [mockCustomWorkflow],
      });

      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.predefined).toHaveLength(4);
      expect(res.body.data.custom).toHaveLength(1);
      expect(res.body.data.predefined[0].id).toBe('full-test-suite');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/testpilot/workflows');

      expect(res.status).toBe(401);
    });

    it('should include workflow metadata', async () => {
      mockOrchestratorService.listWorkflows.mockResolvedValue({
        predefined: mockPredefinedWorkflows,
        custom: [],
      });

      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.predefined.forEach((workflow: Record<string, unknown>) => {
        expect(workflow).toHaveProperty('id');
        expect(workflow).toHaveProperty('name');
        expect(workflow).toHaveProperty('description');
        expect(workflow).toHaveProperty('agents');
      });
    });

    it('should filter workflows by type when query param provided', async () => {
      mockOrchestratorService.listWorkflows.mockResolvedValue({
        predefined: mockPredefinedWorkflows,
        custom: [mockCustomWorkflow],
      });

      const res = await request(app)
        .get('/api/testpilot/workflows?type=predefined')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.predefined).toBeDefined();
    });
  });

  // ==========================================================================
  // POST /api/testpilot/workflows - Create Custom Workflow
  // ==========================================================================

  describe('POST /api/testpilot/workflows', () => {
    it('should create a custom workflow', async () => {
      mockOrchestratorService.createCustomWorkflow.mockResolvedValue(mockCustomWorkflow);

      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Custom Workflow',
          description: 'A custom workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent',
              agent: 'TestWeaver',
              operation: 'generate',
              input: { specification: '${input.specification}' },
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(workflowId);
      expect(res.body.data.name).toBe('Custom Workflow');
    });

    it('should return 400 for invalid workflow definition', async () => {
      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',  // Invalid: empty name
          steps: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing name and steps
          description: 'Just a description',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid step type', async () => {
      mockOrchestratorService.createCustomWorkflow.mockRejectedValue(
        new Error('Invalid step type: invalid-type')
      );

      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'invalid-type',
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for unknown agent', async () => {
      mockOrchestratorService.createCustomWorkflow.mockRejectedValue(
        new Error('Unknown agent: UnknownAgent')
      );

      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent',
              agent: 'UnknownAgent',
              operation: 'generate',
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/testpilot/workflows')
        .send({
          name: 'Test Workflow',
          steps: [],
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin users creating workflows', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'qae' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'qae',
        isActive: true,
      });

      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Custom Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent',
              agent: 'TestWeaver',
              operation: 'generate',
            },
          ],
        });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // GET /api/testpilot/workflows/:id - Get Workflow Details
  // ==========================================================================

  describe('GET /api/testpilot/workflows/:id', () => {
    it('should return workflow details for predefined workflow', async () => {
      mockOrchestratorService.getWorkflowDefinition.mockResolvedValue(mockPredefinedWorkflows[0]);

      const res = await request(app)
        .get('/api/testpilot/workflows/full-test-suite')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('full-test-suite');
      expect(res.body.data.name).toBe('Full Test Suite');
    });

    it('should return workflow details for custom workflow', async () => {
      mockOrchestratorService.getWorkflowDefinition.mockResolvedValue(mockCustomWorkflow);

      const res = await request(app)
        .get(`/api/testpilot/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(workflowId);
    });

    it('should return 404 for non-existent workflow', async () => {
      mockOrchestratorService.getWorkflowDefinition.mockRejectedValue(
        new Error("Workflow with id 'nonexistent' not found")
      );

      const res = await request(app)
        .get('/api/testpilot/workflows/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/testpilot/workflows/full-test-suite');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/testpilot/execute - Execute Workflow
  // ==========================================================================

  describe('POST /api/testpilot/execute', () => {
    it('should execute a predefined workflow', async () => {
      mockOrchestratorService.executeWorkflow.mockResolvedValue(mockExecution);

      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            specification: 'User should be able to login',
            projectId,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(executionId);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.output).toBeDefined();
    });

    it('should execute a custom workflow', async () => {
      mockOrchestratorService.executeCustomWorkflow.mockResolvedValue(mockExecution);
      mockOrchestratorService.getWorkflowDefinition.mockResolvedValue(mockCustomWorkflow);

      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: workflowId,
          input: {
            specification: 'User should be able to login',
            projectId,
          },
        });

      expect(res.status).toBe(201);
    });

    it('should return 400 for missing workflowId', async () => {
      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: {
            specification: 'Test spec',
            projectId,
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing projectId in input', async () => {
      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            specification: 'Test spec',
            // projectId is missing
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing required workflow input', async () => {
      mockOrchestratorService.executeWorkflow.mockRejectedValue(
        new Error('specification is required for full-test-suite workflow')
      );

      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            projectId,
            // specification is missing
          },
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown workflow', async () => {
      mockOrchestratorService.executeWorkflow.mockRejectedValue(
        new Error('Unknown workflow: unknown-workflow')
      );

      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'unknown-workflow',
          input: {
            specification: 'Test spec',
            projectId,
          },
        });

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/testpilot/execute')
        .send({
          workflowId: 'full-test-suite',
          input: { specification: 'Test spec', projectId },
        });

      expect(res.status).toBe(401);
    });

    it('should include execution options when provided', async () => {
      mockOrchestratorService.executeWorkflow.mockResolvedValue(mockExecution);

      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            specification: 'User should be able to login',
            projectId,
          },
          options: {
            timeout: 60000,
            maxRetries: 3,
            continueOnError: false,
          },
        });

      expect(res.status).toBe(201);
      expect(mockOrchestratorService.executeWorkflow).toHaveBeenCalledWith(
        'full-test-suite',
        expect.objectContaining({ specification: 'User should be able to login' }),
        expect.objectContaining({ timeout: 60000 })
      );
    });

    it('should handle workflow execution failure', async () => {
      const failedExecution = {
        ...mockExecution,
        status: 'failed',
        error: 'TestWeaver agent failed: API timeout',
      };
      mockOrchestratorService.executeWorkflow.mockResolvedValue(failedExecution);

      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            specification: 'User should be able to login',
            projectId,
          },
        });

      expect(res.status).toBe(201);  // Still returns 201 because execution was created
      expect(res.body.data.status).toBe('failed');
      expect(res.body.data.error).toContain('API timeout');
    });
  });

  // ==========================================================================
  // GET /api/testpilot/executions/:id - Get Execution Status
  // ==========================================================================

  describe('GET /api/testpilot/executions/:id', () => {
    it('should return execution status', async () => {
      mockOrchestratorService.getWorkflowStatus.mockResolvedValue({
        ...mockExecution,
        completedSteps: 3,
        totalSteps: 3,
        elapsedMs: 30000,
      });

      const res = await request(app)
        .get(`/api/testpilot/executions/${executionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(executionId);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completedSteps).toBe(3);
      expect(res.body.data.totalSteps).toBe(3);
    });

    it('should return running execution with progress', async () => {
      mockOrchestratorService.getWorkflowStatus.mockResolvedValue({
        ...mockExecution,
        status: 'running',
        completedSteps: 1,
        totalSteps: 3,
        elapsedMs: 10000,
      });

      const res = await request(app)
        .get(`/api/testpilot/executions/${executionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('running');
      expect(res.body.data.completedSteps).toBe(1);
    });

    it('should return 404 for non-existent execution', async () => {
      mockOrchestratorService.getWorkflowStatus.mockRejectedValue(
        new Error("Workflow execution with id 'nonexistent' not found")
      );

      const res = await request(app)
        .get('/api/testpilot/executions/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get(`/api/testpilot/executions/${executionId}`);

      expect(res.status).toBe(401);
    });

    it('should include step details', async () => {
      mockOrchestratorService.getWorkflowStatus.mockResolvedValue({
        ...mockExecution,
        completedSteps: 3,
        totalSteps: 3,
      });

      const res = await request(app)
        .get(`/api/testpilot/executions/${executionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.steps).toHaveLength(3);
      res.body.data.steps.forEach((step: Record<string, unknown>) => {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('status');
        expect(step).toHaveProperty('agent');
      });
    });
  });

  // ==========================================================================
  // POST /api/testpilot/executions/:id/cancel - Cancel Execution
  // ==========================================================================

  describe('POST /api/testpilot/executions/:id/cancel', () => {
    it('should cancel a running execution', async () => {
      mockOrchestratorService.cancelWorkflow.mockResolvedValue({
        ...mockExecution,
        status: 'cancelled',
      });

      const res = await request(app)
        .post(`/api/testpilot/executions/${executionId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should return 404 for non-existent execution', async () => {
      mockOrchestratorService.cancelWorkflow.mockRejectedValue(
        new Error("Workflow execution with id 'nonexistent' not found")
      );

      const res = await request(app)
        .post('/api/testpilot/executions/nonexistent/cancel')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 if execution is already completed', async () => {
      mockOrchestratorService.cancelWorkflow.mockRejectedValue(
        new Error('Cannot cancel workflow with status: completed')
      );

      const res = await request(app)
        .post(`/api/testpilot/executions/${executionId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 if execution is already cancelled', async () => {
      mockOrchestratorService.cancelWorkflow.mockRejectedValue(
        new Error('Cannot cancel workflow with status: cancelled')
      );

      const res = await request(app)
        .post(`/api/testpilot/executions/${executionId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 if execution has already failed', async () => {
      mockOrchestratorService.cancelWorkflow.mockRejectedValue(
        new Error('Cannot cancel workflow with status: failed')
      );

      const res = await request(app)
        .post(`/api/testpilot/executions/${executionId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).post(`/api/testpilot/executions/${executionId}/cancel`);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/testpilot/estimate - Estimate Workflow Cost
  // ==========================================================================

  describe('POST /api/testpilot/estimate', () => {
    it('should return cost estimate for workflow', async () => {
      mockOrchestratorService.estimateCost.mockResolvedValue(mockCostEstimate);

      const res = await request(app)
        .post('/api/testpilot/estimate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            specification: 'User should be able to login',
            projectId,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.estimatedCostUsd).toBe(0.05);
      expect(res.body.data.breakdown).toHaveLength(3);
    });

    it('should return breakdown by step', async () => {
      mockOrchestratorService.estimateCost.mockResolvedValue(mockCostEstimate);

      const res = await request(app)
        .post('/api/testpilot/estimate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            specification: 'User should be able to login',
            projectId,
          },
        });

      expect(res.status).toBe(200);
      res.body.data.breakdown.forEach((step: Record<string, unknown>) => {
        expect(step).toHaveProperty('stepId');
        expect(step).toHaveProperty('agent');
        expect(step).toHaveProperty('estimatedCostUsd');
        expect(step).toHaveProperty('estimatedTokens');
      });
    });

    it('should return 400 for missing workflowId', async () => {
      const res = await request(app)
        .post('/api/testpilot/estimate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          input: { specification: 'Test spec', projectId },
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown workflow', async () => {
      mockOrchestratorService.estimateCost.mockRejectedValue(
        new Error('Unknown workflow: unknown-workflow')
      );

      const res = await request(app)
        .post('/api/testpilot/estimate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'unknown-workflow',
          input: { specification: 'Test spec', projectId },
        });

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/testpilot/estimate')
        .send({
          workflowId: 'full-test-suite',
          input: { specification: 'Test spec', projectId },
        });

      expect(res.status).toBe(401);
    });

    it('should estimate higher cost for larger inputs', async () => {
      const smallEstimate = { ...mockCostEstimate, estimatedCostUsd: 0.05 };
      const largeEstimate = { ...mockCostEstimate, estimatedCostUsd: 0.15 };

      mockOrchestratorService.estimateCost
        .mockResolvedValueOnce(smallEstimate)
        .mockResolvedValueOnce(largeEstimate);

      const smallRes = await request(app)
        .post('/api/testpilot/estimate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: { specification: 'Simple test', projectId },
        });

      const largeRes = await request(app)
        .post('/api/testpilot/estimate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: { specification: 'A very detailed specification '.repeat(100), projectId },
        });

      expect(largeRes.body.data.estimatedCostUsd).toBeGreaterThan(smallRes.body.data.estimatedCostUsd);
    });
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe('authentication', () => {
    it('should return 401 for expired token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(401);
    });

    it('should return 401 for missing Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', adminToken);

      expect(res.status).toBe(401);
    });

    it('should return 401 for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'admin',
        isActive: false,
      });

      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // Authorization Tests
  // ==========================================================================

  describe('authorization', () => {
    it('should allow qae users to list workflows', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'qae' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'qae',
        isActive: true,
      });
      mockOrchestratorService.listWorkflows.mockResolvedValue({
        predefined: mockPredefinedWorkflows,
        custom: [],
      });

      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
    });

    it('should allow qae users to execute workflows', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'qae' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'qae',
        isActive: true,
      });
      mockOrchestratorService.executeWorkflow.mockResolvedValue(mockExecution);

      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: { specification: 'Test spec', projectId },
        });

      expect(res.status).toBe(201);
    });

    it('should restrict custom workflow creation to admin/lead', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'qae' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'qae',
        isActive: true,
      });

      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Custom Workflow',
          steps: [],
        });

      expect(res.status).toBe(403);
    });

    it('should allow lead users to create custom workflows', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'lead' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'lead',
        isActive: true,
      });
      mockOrchestratorService.createCustomWorkflow.mockResolvedValue(mockCustomWorkflow);

      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Custom Workflow',
          steps: [
            {
              id: 'step-1',
              type: 'agent',
              agent: 'TestWeaver',
              operation: 'generate',
            },
          ],
        });

      expect(res.status).toBe(201);
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('validation', () => {
    it('should validate workflow step structure', async () => {
      const res = await request(app)
        .post('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Workflow',
          steps: [
            {
              // Missing id
              type: 'agent',
              agent: 'TestWeaver',
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should validate execution input structure', async () => {
      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          // Missing input object
        });

      expect(res.status).toBe(400);
    });

    it('should validate UUID format for execution id', async () => {
      const res = await request(app)
        .get('/api/testpilot/executions/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should validate projectId is a valid UUID', async () => {
      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          workflowId: 'full-test-suite',
          input: {
            specification: 'Test spec',
            projectId: 'invalid-uuid',
          },
        });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // Error Response Format Tests
  // ==========================================================================

  describe('error response format', () => {
    it('should return consistent error format for 400 errors', async () => {
      const res = await request(app)
        .post('/api/testpilot/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });

    it('should return consistent error format for 404 errors', async () => {
      mockOrchestratorService.getWorkflowStatus.mockRejectedValue(
        new Error("Workflow execution with id 'nonexistent' not found")
      );

      const res = await request(app)
        .get('/api/testpilot/executions/33333333-3333-3333-3333-333333333333')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });

    it('should return consistent error format for 500 errors', async () => {
      mockOrchestratorService.listWorkflows.mockRejectedValue(new Error('Internal server error'));

      const res = await request(app)
        .get('/api/testpilot/workflows')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ==========================================================================
  // GET /api/testpilot/executions - List Executions (Optional)
  // ==========================================================================

  describe('GET /api/testpilot/executions', () => {
    it('should return paginated list of executions', async () => {
      mockPrisma.workflowExecution.findMany.mockResolvedValue([mockExecution]);
      mockPrisma.workflowExecution.count = vi.fn().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/testpilot/executions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId, page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.workflowExecution.findMany.mockResolvedValue([mockExecution]);
      mockPrisma.workflowExecution.count = vi.fn().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/testpilot/executions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId, status: 'completed' });

      expect(res.status).toBe(200);
      expect(mockPrisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed' }),
        })
      );
    });

    it('should filter by workflowId', async () => {
      mockPrisma.workflowExecution.findMany.mockResolvedValue([mockExecution]);
      mockPrisma.workflowExecution.count = vi.fn().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/testpilot/executions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId, workflowId: 'full-test-suite' });

      expect(res.status).toBe(200);
      expect(mockPrisma.workflowExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workflowId: 'full-test-suite' }),
        })
      );
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/testpilot/executions').query({ projectId });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // DELETE /api/testpilot/workflows/:id - Delete Custom Workflow
  // ==========================================================================

  describe('DELETE /api/testpilot/workflows/:id', () => {
    it('should delete a custom workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockCustomWorkflow);
      mockPrisma.workflow.delete.mockResolvedValue(mockCustomWorkflow);

      const res = await request(app)
        .delete(`/api/testpilot/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/testpilot/workflows/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for predefined workflow', async () => {
      const res = await request(app)
        .delete('/api/testpilot/workflows/full-test-suite')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('predefined');
    });

    it('should return 403 for non-admin users', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123', role: 'qae' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'qae',
        isActive: true,
      });

      const res = await request(app)
        .delete(`/api/testpilot/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).delete(`/api/testpilot/workflows/${workflowId}`);

      expect(res.status).toBe(401);
    });
  });
});
