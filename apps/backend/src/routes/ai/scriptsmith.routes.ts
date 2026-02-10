/**
 * ScriptSmith Agent Routes
 */

import { Router, Request } from 'express';
import { z } from 'zod';
import { scriptSmithAgent } from '../../agents/scriptsmith.agent.js';
import { aiUsageService } from '../../services/aiusage.service.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { trackAiUsage } from '../../utils/request-helpers.js';
import { DEVICE_PROFILES, getDevicesByType } from '../../types/deviceTargeting.js';

const router = Router();

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
    base64: z.string().min(100),
    annotations: z.array(screenshotAnnotationSchema).optional(),
    url: z.string().optional(),
  }).optional(),
  options: z.object({
    framework: z.enum(['playwright', 'cypress']).optional(),
    language: z.enum(['typescript', 'javascript']).optional(),
    includePageObjects: z.boolean().optional(),
    useExistingHelpers: z.array(z.string()).optional(),
    baseUrl: z.string().optional(),
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

  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'ScriptSmith', operation: 'generate', result,
  });

  res.json({ message: 'Script generated', data: result.data, usage: result.usage });
}));

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

  await trackAiUsage(aiUsageService, {
    projectId: data.projectId, userId: user.id, agent: 'ScriptSmith', operation: 'edit', result,
  });

  res.json({ message: 'Script edited', data: result.data, usage: result.usage });
}));

export default router;
