/**
 * CodeGuardian Agent Routes
 */

import { Router, Request } from 'express';
import { z } from 'zod';
import { codeGuardianAgent } from '../../agents/codeguardian.agent.js';
import { aiUsageService } from '../../services/aiusage.service.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { trackAiUsage } from '../../utils/request-helpers.js';

const router = Router();

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
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'CodeGuardian', operation: 'generate', result,
  });
  res.json({ message: 'Unit tests generated', data: result.data, usage: result.usage });
}));

router.post('/code-guardian/analyze', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(codeGuardianAnalyzeSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await codeGuardianAgent.analyzeCoverage({ code: data.code, existingTests: data.existingTests, coverageReport: data.coverageReport });
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'CodeGuardian', operation: 'analyze', result,
  });
  res.json({ message: 'Coverage analyzed', data: result.data, usage: result.usage });
}));

export default router;
