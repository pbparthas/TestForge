/**
 * Recorder Routes
 * Routes for converting browser recordings to automation scripts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { recorderAgent } from '../agents/recorder.agent.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';

const router = Router();
router.use(authenticate);

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.errors.map(e => ({
      field: e.path.join('.'), message: e.message,
    })));
  }
  return result.data;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const elementSelectorSchema = z.object({
  css: z.string().optional(),
  xpath: z.string().optional(),
  text: z.string().optional(),
  testId: z.string().optional(),
  role: z.object({
    name: z.string(),
    options: z.object({
      name: z.string().optional(),
      exact: z.boolean().optional(),
    }).optional(),
  }).optional(),
  placeholder: z.string().optional(),
  label: z.string().optional(),
  alt: z.string().optional(),
  title: z.string().optional(),
});

const recordedActionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'click', 'dblclick', 'type', 'fill', 'navigate', 'scroll', 'hover',
    'select', 'upload', 'keypress', 'wait', 'drag', 'focus', 'blur',
  ]),
  timestamp: z.number(),
  target: elementSelectorSchema,
  value: z.string().optional(),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
    clientX: z.number().optional(),
    clientY: z.number().optional(),
  }).optional(),
  metadata: z.object({
    tagName: z.string().optional(),
    textContent: z.string().optional(),
    isVisible: z.boolean().optional(),
    isInViewport: z.boolean().optional(),
    boundingBox: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional(),
    fileNames: z.array(z.string()).optional(),
    selectedOption: z.object({
      value: z.string(),
      text: z.string(),
    }).optional(),
    modifiers: z.array(z.string()).optional(),
    frameId: z.string().optional(),
    shadowPath: z.array(z.string()).optional(),
  }).optional(),
});

const deviceTargetSchema = z.object({
  type: z.enum(['desktop', 'mobile', 'tablet']),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  deviceName: z.string().optional(),
  userAgent: z.string().optional(),
  isTouchEnabled: z.boolean().optional(),
  deviceScaleFactor: z.number().optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
});

const recordingBaseSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  url: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  browser: z.enum(['chromium', 'firefox', 'webkit', 'chrome', 'edge']),
  userAgent: z.string().optional(),
  actions: z.array(recordedActionSchema),
  duration: z.number(),
  recordedAt: z.string(),
  deviceProfile: deviceTargetSchema.optional(),
});

// Recording schema with at least 1 action (for convert, assertions)
const recordingWithActionsSchema = recordingBaseSchema.extend({
  actions: z.array(recordedActionSchema).min(1, 'Recording must have at least one action'),
});

// =============================================================================
// CONVERT ROUTE
// =============================================================================

const convertSchema = z.object({
  recording: recordingWithActionsSchema,
  options: z.object({
    framework: z.enum(['playwright', 'cypress', 'selenium']),
    language: z.enum(['typescript', 'javascript', 'python', 'java', 'csharp']),
    includePageObjects: z.boolean().optional(),
    baseUrl: z.string().optional(),
    testName: z.string().optional(),
    includeComments: z.boolean().optional(),
    selectorPreference: z.array(z.enum(['role', 'testid', 'text', 'css', 'xpath'])).optional(),
    waitStrategy: z.enum(['minimal', 'standard', 'conservative']).optional(),
    includeDeviceEmulation: z.boolean().optional(),
    extractUtilities: z.boolean().optional(),
    addLogging: z.boolean().optional(),
  }).optional(),
});

/**
 * POST /api/recorder/convert
 * Convert a browser recording to an automation script
 */
router.post('/convert', asyncHandler(async (req, res) => {
  const data = validate(convertSchema, req.body);

  const options = {
    framework: data.options?.framework ?? 'playwright',
    language: data.options?.language ?? 'typescript',
    ...data.options,
  } as const;

  const result = await recorderAgent.convertToScript(data.recording, options);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// OPTIMIZE ROUTE
// =============================================================================

const optimizeSchema = z.object({
  recording: recordingBaseSchema,
  options: z.object({
    removeDuplicates: z.boolean().optional(),
    mergeTypeActions: z.boolean().optional(),
    removeUnnecessaryScrolls: z.boolean().optional(),
    improveSelectors: z.boolean().optional(),
    addSmartWaits: z.boolean().optional(),
    collapseRapidClicks: z.boolean().optional(),
    removeRedundantHovers: z.boolean().optional(),
    actionMergeThreshold: z.number().optional(),
  }).optional(),
});

/**
 * POST /api/recorder/optimize
 * Optimize a recording by removing redundant actions and improving selectors
 */
router.post('/optimize', asyncHandler(async (req, res) => {
  const data = validate(optimizeSchema, req.body);

  const result = await recorderAgent.optimizeRecording(data.recording, data.options);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// ASSERTIONS ROUTE
// =============================================================================

const assertionsSchema = z.object({
  recording: recordingWithActionsSchema,
  hints: z.array(z.object({
    afterActionId: z.string().optional(),
    type: z.enum([
      'visible', 'hidden', 'enabled', 'disabled', 'checked', 'unchecked',
      'text', 'value', 'attribute', 'url', 'title', 'count', 'screenshot',
    ]).optional(),
    description: z.string().optional(),
    expectedValue: z.string().optional(),
  })).optional(),
});

/**
 * POST /api/recorder/assertions
 * Add assertions to a recording
 */
router.post('/assertions', asyncHandler(async (req, res) => {
  const data = validate(assertionsSchema, req.body);

  const result = await recorderAgent.addAssertions(data.recording, data.hints);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// SELECTORS ROUTE
// =============================================================================

const selectorsSchema = z.object({
  element: z.object({
    currentSelector: elementSelectorSchema,
    html: z.string().optional(),
    attributes: z.record(z.string()).optional(),
    context: z.string().optional(),
    pageUrl: z.string().optional(),
  }),
});

/**
 * POST /api/recorder/selectors
 * Suggest robust selectors for an element
 */
router.post('/selectors', asyncHandler(async (req, res) => {
  const data = validate(selectorsSchema, req.body);

  const result = await recorderAgent.suggestSelectors(data.element);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

// =============================================================================
// PROCESS ROUTE (FULL PIPELINE)
// =============================================================================

const processSchema = z.object({
  recording: recordingWithActionsSchema,
  options: z.object({
    conversion: z.object({
      framework: z.enum(['playwright', 'cypress', 'selenium']),
      language: z.enum(['typescript', 'javascript', 'python', 'java', 'csharp']),
      includePageObjects: z.boolean().optional(),
      baseUrl: z.string().optional(),
      testName: z.string().optional(),
      includeComments: z.boolean().optional(),
      selectorPreference: z.array(z.enum(['role', 'testid', 'text', 'css', 'xpath'])).optional(),
      waitStrategy: z.enum(['minimal', 'standard', 'conservative']).optional(),
      includeDeviceEmulation: z.boolean().optional(),
      extractUtilities: z.boolean().optional(),
      addLogging: z.boolean().optional(),
    }),
    optimization: z.object({
      removeDuplicates: z.boolean().optional(),
      mergeTypeActions: z.boolean().optional(),
      removeUnnecessaryScrolls: z.boolean().optional(),
      improveSelectors: z.boolean().optional(),
      addSmartWaits: z.boolean().optional(),
      collapseRapidClicks: z.boolean().optional(),
      removeRedundantHovers: z.boolean().optional(),
      actionMergeThreshold: z.number().optional(),
    }).optional(),
    assertionHints: z.array(z.object({
      afterActionId: z.string().optional(),
      type: z.enum([
        'visible', 'hidden', 'enabled', 'disabled', 'checked', 'unchecked',
        'text', 'value', 'attribute', 'url', 'title', 'count', 'screenshot',
      ]).optional(),
      description: z.string().optional(),
      expectedValue: z.string().optional(),
    })).optional(),
    skipOptimization: z.boolean().optional(),
    skipAssertions: z.boolean().optional(),
  }),
});

/**
 * POST /api/recorder/process
 * Full pipeline: optimize, add assertions, and convert to script
 */
router.post('/process', asyncHandler(async (req, res) => {
  const data = validate(processSchema, req.body);

  const result = await recorderAgent.processRecording(data.recording, data.options);

  res.json({
    data: result.data,
    usage: result.usage,
  });
}));

export default router;
