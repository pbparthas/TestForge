/**
 * AI Agent Routes
 * Routes for TestWeaver, ScriptSmith, and AI usage tracking
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { testWeaverAgent } from '../agents/testweaver.agent.js';
import { scriptSmithAgent } from '../agents/scriptsmith.agent.js';
import { frameworkAgent } from '../agents/framework.agent.js';
import { selfHealingAgent } from '../agents/selfhealing.agent.js';
import { flowPilotAgent } from '../agents/flowpilot.agent.js';
import { codeGuardianAgent } from '../agents/codeguardian.agent.js';
import { aiUsageService } from '../services/aiusage.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { DEVICE_PROFILES, getDevicesByType } from '../types/deviceTargeting.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// TESTWEAVER ROUTES (Sprint 8: Enhanced with screenshot, file upload, conversation, batch, mapping)
// =============================================================================

const screenshotInputSchema = z.object({
  base64: z.string().min(100),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  annotations: z.array(z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    label: z.string(),
    type: z.enum(['click', 'input', 'assert', 'highlight']).optional(),
  })).optional(),
  context: z.string().optional(),
});

const fileUploadInputSchema = z.object({
  content: z.string().min(1),
  fileName: z.string(),
  mimeType: z.enum(['text/csv', 'application/json', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  mapping: z.record(z.string()).optional(),
});

const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const mappingContextSchema = z.object({
  products: z.array(z.string()).optional(),
  partners: z.array(z.string()).optional(),
  modules: z.array(z.string()).optional(),
});

const testWeaverGenerateSchema = z.object({
  projectId: z.string().uuid(),
  specification: z.string().min(10).optional(),
  inputMethod: z.enum(['specification', 'natural_language', 'existing_test', 'screenshot', 'file_upload', 'conversation']),
  screenshot: screenshotInputSchema.optional(),
  fileUpload: fileUploadInputSchema.optional(),
  conversation: z.array(conversationMessageSchema).optional(),
  options: z.object({
    maxTestCases: z.number().min(1).max(50).optional(),
    includeNegativeCases: z.boolean().optional(),
    includeEdgeCases: z.boolean().optional(),
    focusAreas: z.array(z.string()).optional(),
    testTypes: z.array(z.enum(['functional', 'integration', 'e2e', 'api'])).optional(),
    includeMapping: z.boolean().optional(),
    mappingContext: mappingContextSchema.optional(),
  }).optional(),
});

const testWeaverBatchGenerateSchema = z.object({
  projectId: z.string().uuid(),
  specifications: z.array(z.object({
    id: z.string(),
    content: z.string().min(10),
    inputMethod: z.enum(['specification', 'natural_language', 'existing_test']),
  })).min(1).max(20),
  options: z.object({
    maxTestCases: z.number().min(1).max(50).optional(),
    includeNegativeCases: z.boolean().optional(),
    includeEdgeCases: z.boolean().optional(),
    focusAreas: z.array(z.string()).optional(),
    testTypes: z.array(z.enum(['functional', 'integration', 'e2e', 'api'])).optional(),
    includeMapping: z.boolean().optional(),
    mappingContext: mappingContextSchema.optional(),
  }).optional(),
});

const testWeaverEvolveSchema = z.object({
  projectId: z.string().uuid(),
  existingTestCases: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    steps: z.array(z.object({
      order: z.number(),
      action: z.string(),
      expected: z.string(),
    })),
  })),
  oldSpecification: z.string().min(10),
  newSpecification: z.string().min(10),
});

router.post('/test-weaver/generate', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(testWeaverGenerateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;

  const result = await testWeaverAgent.generate({
    ...(data.specification && { specification: data.specification }),
    inputMethod: data.inputMethod,
    ...(data.screenshot && { screenshot: data.screenshot }),
    ...(data.fileUpload && { fileUpload: data.fileUpload }),
    ...(data.conversation && { conversation: data.conversation }),
    ...(data.options && { options: data.options }),
  });

  // Track usage
  await aiUsageService.record({
    projectId: data.projectId,
    userId: user.id,
    agent: 'TestWeaver',
    operation: 'generate',
    model: result.usage.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedTokens: result.usage.cacheReadTokens,
    costUsd: result.usage.costUsd,
    costInr: result.usage.costInr,
    durationMs: result.usage.durationMs,
  });

  res.json({
    message: 'Test cases generated',
    data: result.data,
    usage: result.usage,
  });
}));

/**
 * POST /test-weaver/batch - Sprint 8: Batch generate test cases
 */
router.post('/test-weaver/batch', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(testWeaverBatchGenerateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;

  const result = await testWeaverAgent.batchGenerate({
    specifications: data.specifications,
    ...(data.options && { options: data.options }),
  });

  // Track usage
  await aiUsageService.record({
    projectId: data.projectId,
    userId: user.id,
    agent: 'TestWeaver',
    operation: 'batch-generate',
    model: result.usage.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedTokens: result.usage.cacheReadTokens,
    costUsd: result.usage.costUsd,
    costInr: result.usage.costInr,
    durationMs: result.usage.durationMs,
  });

  res.json({
    message: 'Batch generation completed',
    data: result.data,
    usage: result.usage,
  });
}));

router.post('/test-weaver/evolve', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(testWeaverEvolveSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;

  const result = await testWeaverAgent.evolve({
    existingTestCases: data.existingTestCases,
    oldSpecification: data.oldSpecification,
    newSpecification: data.newSpecification,
  });

  // Track usage
  await aiUsageService.record({
    projectId: data.projectId,
    userId: user.id,
    agent: 'TestWeaver',
    operation: 'evolve',
    model: result.usage.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedTokens: result.usage.cacheReadTokens,
    costUsd: result.usage.costUsd,
    costInr: result.usage.costInr,
    durationMs: result.usage.durationMs,
  });

  res.json({
    message: 'Test cases evolved',
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// SCRIPTSMITH ROUTES
// =============================================================================

const deviceTargetSchema = z.object({
  type: z.enum(['desktop', 'tablet', 'mobile']),
  deviceName: z.string().optional(),
  viewport: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  userAgent: z.string().optional(),
  isTouchEnabled: z.boolean().optional(),
  pixelRatio: z.number().positive().optional(),
}).optional();

const screenshotAnnotationSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  label: z.string(),
  type: z.enum(['click', 'input', 'assert', 'highlight']).optional(),
});

const scriptSmithGenerateSchema = z.object({
  projectId: z.string().uuid(),
  inputMethod: z.enum(['test_case', 'recording', 'description', 'screenshot']),
  testCase: z.object({
    title: z.string(),
    steps: z.array(z.object({
      order: z.number(),
      action: z.string(),
      expected: z.string(),
    })),
    preconditions: z.string().optional(),
  }).optional(),
  recording: z.object({
    actions: z.array(z.object({
      type: z.enum(['click', 'fill', 'navigate', 'wait', 'assert']),
      selector: z.string().optional(),
      value: z.string().optional(),
      url: z.string().optional(),
    })),
  }).optional(),
  description: z.string().optional(),
  screenshot: z.object({
    base64: z.string().min(100), // Base64 encoded image
    annotations: z.array(screenshotAnnotationSchema).optional(),
    url: z.string().optional(),
  }).optional(),
  options: z.object({
    framework: z.enum(['playwright', 'cypress']).optional(),
    language: z.enum(['typescript', 'javascript']).optional(),
    includePageObjects: z.boolean().optional(),
    useExistingHelpers: z.array(z.string()).optional(),
    baseUrl: z.string().optional(),
    // Sprint 7: New transformation options
    extractUtilities: z.boolean().optional(),
    addLogging: z.boolean().optional(),
    generateRandomData: z.boolean().optional(),
    includeComments: z.boolean().optional(),
    waitStrategy: z.enum(['minimal', 'standard', 'conservative']).optional(),
    selectorPreference: z.enum(['role', 'testid', 'text', 'css']).optional(),
    codeStyle: z.enum(['match-project', 'playwright-best-practices']).optional(),
    deviceTarget: deviceTargetSchema,
  }).optional(),
});

const scriptSmithEditSchema = z.object({
  projectId: z.string().uuid(),
  existingCode: z.string().min(10),
  instruction: z.string().min(5),
  context: z.object({
    errorMessage: z.string().optional(),
    failedSelector: z.string().optional(),
  }).optional(),
});

router.post('/script-smith/generate', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(scriptSmithGenerateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;

  const result = await scriptSmithAgent.generate({
    inputMethod: data.inputMethod,
    testCase: data.testCase,
    recording: data.recording,
    description: data.description,
    screenshot: data.screenshot,
    options: data.options,
  });

  // Track usage
  await aiUsageService.record({
    projectId: data.projectId,
    userId: user.id,
    agent: 'ScriptSmith',
    operation: 'generate',
    model: result.usage.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedTokens: result.usage.cacheReadTokens,
    costUsd: result.usage.costUsd,
    costInr: result.usage.costInr,
    durationMs: result.usage.durationMs,
  });

  res.json({
    message: 'Script generated',
    data: result.data,
    usage: result.usage,
  });
}));

/**
 * GET /script-smith/devices
 * Get available device profiles for script generation
 */
router.get('/script-smith/devices', asyncHandler(async (_req, res) => {
  res.json({
    data: {
      all: Object.values(DEVICE_PROFILES),
      desktop: getDevicesByType('desktop'),
      tablet: getDevicesByType('tablet'),
      mobile: getDevicesByType('mobile'),
    },
  });
}));

router.post('/script-smith/edit', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(scriptSmithEditSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;

  const result = await scriptSmithAgent.edit({
    existingCode: data.existingCode,
    instruction: data.instruction,
    context: data.context,
  });

  // Track usage
  await aiUsageService.record({
    projectId: data.projectId,
    userId: user.id,
    agent: 'ScriptSmith',
    operation: 'edit',
    model: result.usage.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedTokens: result.usage.cacheReadTokens,
    costUsd: result.usage.costUsd,
    costInr: result.usage.costInr,
    durationMs: result.usage.durationMs,
  });

  res.json({
    message: 'Script edited',
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// FRAMEWORK AGENT ROUTES
// =============================================================================

const frameworkAnalyzeSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(10),
  framework: z.enum(['playwright', 'cypress']),
  options: z.object({
    checkPageObjects: z.boolean().optional(),
    checkCodeSmells: z.boolean().optional(),
    checkBestPractices: z.boolean().optional(),
  }).optional(),
});

const frameworkReviewSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(10),
  framework: z.enum(['playwright', 'cypress']),
  testCase: z.object({
    title: z.string(),
    steps: z.array(z.object({ action: z.string(), expected: z.string() })),
  }).optional(),
});

router.post('/framework/analyze', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(frameworkAnalyzeSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await frameworkAgent.analyze({ code: data.code, framework: data.framework, options: data.options });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'FrameworkAgent', operation: 'analyze', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'Code analyzed', data: result.data, usage: result.usage });
}));

router.post('/framework/review', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(frameworkReviewSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await frameworkAgent.review({ code: data.code, framework: data.framework, testCase: data.testCase });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'FrameworkAgent', operation: 'review', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'Code reviewed', data: result.data, usage: result.usage });
}));

// =============================================================================
// SELF-HEALING AGENT ROUTES
// =============================================================================

const selfHealingDiagnoseSchema = z.object({
  projectId: z.string().uuid(),
  errorMessage: z.string().min(1),
  errorStack: z.string().optional(),
  failedCode: z.string().min(10),
  selector: z.string().optional(),
  pageHtml: z.string().optional(),
});

const selfHealingFixSchema = z.object({
  projectId: z.string().uuid(),
  failedCode: z.string().min(10),
  diagnosis: z.object({
    type: z.enum(['selector', 'timing', 'assertion', 'network', 'state', 'unknown']),
    confidence: z.number(),
    explanation: z.string(),
  }),
  selectedFix: z.number().min(0),
  context: z.object({
    pageHtml: z.string().optional(),
    availableSelectors: z.array(z.string()).optional(),
  }).optional(),
});

router.post('/self-healing/diagnose', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(selfHealingDiagnoseSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await selfHealingAgent.diagnose({ errorMessage: data.errorMessage, errorStack: data.errorStack, failedCode: data.failedCode, selector: data.selector, pageHtml: data.pageHtml });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'SelfHealingAgent', operation: 'diagnose', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'Failure diagnosed', data: result.data, usage: result.usage });
}));

router.post('/self-healing/fix', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(selfHealingFixSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await selfHealingAgent.fix({ failedCode: data.failedCode, diagnosis: data.diagnosis, selectedFix: data.selectedFix, context: data.context });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'SelfHealingAgent', operation: 'fix', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'Fix applied', data: result.data, usage: result.usage });
}));

// =============================================================================
// FLOWPILOT AGENT ROUTES
// =============================================================================

const flowPilotGenerateSchema = z.object({
  projectId: z.string().uuid(),
  openApiSpec: z.string().optional(),
  endpoint: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string(),
    description: z.string().optional(),
    requestBody: z.record(z.unknown()).optional(),
    responseSchema: z.record(z.unknown()).optional(),
  }).optional(),
  options: z.object({
    includeAuthTests: z.boolean().optional(),
    includeValidationTests: z.boolean().optional(),
    includeErrorCases: z.boolean().optional(),
    framework: z.enum(['playwright', 'jest', 'vitest']).optional(),
  }).optional(),
});

const flowPilotChainSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().min(10),
  steps: z.array(z.object({
    name: z.string(),
    endpoint: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    dependsOn: z.array(z.string()).optional(),
    extractFields: z.array(z.string()).optional(),
  })),
  options: z.object({
    framework: z.enum(['playwright', 'jest', 'vitest']).optional(),
    includeCleanup: z.boolean().optional(),
  }).optional(),
});

router.post('/flow-pilot/generate', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(flowPilotGenerateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await flowPilotAgent.generateApiTests({ openApiSpec: data.openApiSpec, endpoint: data.endpoint, options: data.options });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'FlowPilot', operation: 'generate', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'API tests generated', data: result.data, usage: result.usage });
}));

router.post('/flow-pilot/chain', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(flowPilotChainSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await flowPilotAgent.chain({ description: data.description, steps: data.steps, options: data.options });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'FlowPilot', operation: 'chain', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'API flow chained', data: result.data, usage: result.usage });
}));

// =============================================================================
// CODEGUARDIAN AGENT ROUTES
// =============================================================================

const codeGuardianGenerateSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(10),
  language: z.enum(['typescript', 'javascript']),
  framework: z.enum(['vitest', 'jest', 'mocha']).optional(),
  options: z.object({
    includeEdgeCases: z.boolean().optional(),
    includeMocks: z.boolean().optional(),
    targetCoverage: z.number().min(0).max(100).optional(),
  }).optional(),
});

const codeGuardianAnalyzeSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(10),
  existingTests: z.string().optional(),
  coverageReport: z.object({
    statements: z.number(),
    branches: z.number(),
    functions: z.number(),
    lines: z.number(),
    uncoveredLines: z.array(z.number()),
  }).optional(),
});

router.post('/code-guardian/generate', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(codeGuardianGenerateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await codeGuardianAgent.generateUnitTests({ code: data.code, language: data.language, framework: data.framework, options: data.options });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'CodeGuardian', operation: 'generate', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'Unit tests generated', data: result.data, usage: result.usage });
}));

router.post('/code-guardian/analyze', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(codeGuardianAnalyzeSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await codeGuardianAgent.analyzeCoverage({ code: data.code, existingTests: data.existingTests, coverageReport: data.coverageReport });
  await aiUsageService.record({ projectId: data.projectId, userId: user.id, agent: 'CodeGuardian', operation: 'analyze', model: result.usage.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, costInr: result.usage.costInr, durationMs: result.usage.durationMs });
  res.json({ message: 'Coverage analyzed', data: result.data, usage: result.usage });
}));

// =============================================================================
// AI USAGE ROUTES
// =============================================================================

router.get('/usage', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const projectId = req.query.projectId as string | undefined;
  const agent = req.query.agent as string | undefined;

  const result = await aiUsageService.findAll({ page, limit, projectId, agent });
  res.json({ data: result });
}));

router.get('/usage/summary/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const summary = await aiUsageService.getProjectSummary(projectId, startDate, endDate);
  res.json({ data: summary });
}));

router.get('/usage/daily/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const days = parseInt(req.query.days as string) || 30;

  const dailyCosts = await aiUsageService.getDailyCosts(projectId, days);
  res.json({ data: dailyCosts });
}));

export default router;
