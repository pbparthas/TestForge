/**
 * Self-Healing Agent Routes
 */

import { Router, Request } from 'express';
import { z } from 'zod';
import { selfHealingAgent } from '../../agents/selfhealing.agent.js';
import { aiUsageService } from '../../services/aiusage.service.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { trackAiUsage } from '../../utils/request-helpers.js';

const router = Router();

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
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'SelfHealingAgent', operation: 'diagnose', result,
  });
  res.json({ message: 'Failure diagnosed', data: result.data, usage: result.usage });
}));

router.post('/self-healing/fix', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(selfHealingFixSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await selfHealingAgent.fix({ failedCode: data.failedCode, diagnosis: data.diagnosis, selectedFix: data.selectedFix, context: data.context });
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'SelfHealingAgent', operation: 'fix', result,
  });
  res.json({ message: 'Fix applied', data: result.data, usage: result.usage });
}));

export default router;
