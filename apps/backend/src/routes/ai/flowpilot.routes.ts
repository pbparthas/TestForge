/**
 * FlowPilot Agent Routes
 */

import { Router, Request } from 'express';
import { z } from 'zod';
import { flowPilotAgent } from '../../agents/flowpilot.agent.js';
import { aiUsageService } from '../../services/aiusage.service.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { trackAiUsage } from '../../utils/request-helpers.js';

const router = Router();

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
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'FlowPilot', operation: 'generate', result,
  });
  res.json({ message: 'API tests generated', data: result.data, usage: result.usage });
}));

router.post('/flow-pilot/chain', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(flowPilotChainSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const result = await flowPilotAgent.chain({ description: data.description, steps: data.steps, options: data.options });
  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'FlowPilot', operation: 'chain', result,
  });
  res.json({ message: 'API flow chained', data: result.data, usage: result.usage });
}));

export default router;
