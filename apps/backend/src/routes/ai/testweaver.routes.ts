/**
 * TestWeaver Agent Routes
 */

import { Router, Request } from 'express';
import { z } from 'zod';
import { testWeaverAgent } from '../../agents/testweaver.agent.js';
import { aiUsageService } from '../../services/aiusage.service.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { trackAiUsage } from '../../utils/request-helpers.js';

const router = Router();

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

  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'TestWeaver', operation: 'generate', result,
  });

  res.json({ message: 'Test cases generated', data: result.data, usage: result.usage });
}));

router.post('/test-weaver/batch', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(testWeaverBatchGenerateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;

  const result = await testWeaverAgent.batchGenerate({
    specifications: data.specifications,
    ...(data.options && { options: data.options }),
  });

  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'TestWeaver', operation: 'batch-generate', result,
  });

  res.json({ message: 'Batch generation completed', data: result.data, usage: result.usage });
}));

router.post('/test-weaver/evolve', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(testWeaverEvolveSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;

  const result = await testWeaverAgent.evolve({
    existingTestCases: data.existingTestCases,
    oldSpecification: data.oldSpecification,
    newSpecification: data.newSpecification,
  });

  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'TestWeaver', operation: 'evolve', result,
  });

  res.json({ message: 'Test cases evolved', data: result.data, usage: result.usage });
}));

export default router;
