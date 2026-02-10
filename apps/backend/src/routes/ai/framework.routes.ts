/**
 * Framework Agent Routes
 */

import { Router, Request } from 'express';
import { z } from 'zod';
import { frameworkAgent } from '../../agents/framework.agent.js';
import { aiUsageService } from '../../services/aiusage.service.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { trackAiUsage } from '../../utils/request-helpers.js';

const router = Router();

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
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'FrameworkAgent', operation: 'analyze', result,
  });
  res.json({ message: 'Code analyzed', data: result.data, usage: result.usage });
}));

router.post('/framework/review', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(frameworkReviewSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await frameworkAgent.review({ code: data.code, framework: data.framework, testCase: data.testCase });
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'FrameworkAgent', operation: 'review', result,
  });
  res.json({ message: 'Code reviewed', data: result.data, usage: result.usage });
}));

export default router;
