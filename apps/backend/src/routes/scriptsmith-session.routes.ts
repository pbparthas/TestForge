/**
 * ScriptSmith Session Routes
 * Sprint 13: Session-based workflow API endpoints
 *
 * Routes:
 * - POST /api/scriptsmith/sessions - Create new session
 * - GET /api/scriptsmith/sessions - List user sessions
 * - GET /api/scriptsmith/sessions/:id - Get session details
 * - POST /api/scriptsmith/sessions/:id/input - Update session input
 * - POST /api/scriptsmith/sessions/:id/transform - Transform with AI
 * - POST /api/scriptsmith/sessions/:id/save - Save to framework
 * - DELETE /api/scriptsmith/sessions/:id - Delete session
 * - POST /api/scriptsmith/analyze-framework - Analyze project structure
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { scriptSmithSessionService } from '../services/scriptsmith-session.service.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { sanitizePath } from '../utils/path-security.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createSessionSchema = z.object({
  projectId: z.string().uuid().optional(),
  inputMethod: z.enum(['record', 'upload', 'screenshot', 'describe', 'edit']),
  projectPath: z.string().optional(),
  deviceType: z.string().optional(),
  deviceConfig: z.record(z.unknown()).optional(),
});

const recordingActionSchema = z.object({
  type: z.enum(['click', 'fill', 'navigate', 'wait', 'assert']),
  selector: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  timestamp: z.number().optional(),
});

const updateInputSchema = z.object({
  recording: z
    .object({
      actions: z.array(recordingActionSchema),
      metadata: z
        .object({
          startUrl: z.string().optional(),
          browser: z.string().optional(),
          viewport: z
            .object({
              width: z.number(),
              height: z.number(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  uploadedScript: z
    .object({
      content: z.string(),
      fileName: z.string(),
      language: z.string().optional(),
    })
    .optional(),
  screenshot: z
    .object({
      base64: z.string(),
      annotations: z
        .array(
          z.object({
            x: z.number(),
            y: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
            label: z.string(),
            type: z.enum(['click', 'input', 'assert', 'highlight']).optional(),
          })
        )
        .optional(),
      url: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
  existingScript: z
    .object({
      code: z.string(),
      instruction: z.string(),
      errorMessage: z.string().optional(),
    })
    .optional(),
});

const transformSchema = z.object({
  projectId: z.string().uuid(),
  options: z
    .object({
      framework: z.enum(['playwright', 'cypress']).optional(),
      language: z.enum(['typescript', 'javascript']).optional(),
      includePageObjects: z.boolean().optional(),
      extractUtilities: z.boolean().optional(),
      useExistingHelpers: z.array(z.string()).optional(),
      baseUrl: z.string().optional(),
      addLogging: z.boolean().optional(),
      includeComments: z.boolean().optional(),
      waitStrategy: z.enum(['minimal', 'standard', 'conservative']).optional(),
      selectorPreference: z.enum(['role', 'testid', 'text', 'css']).optional(),
    })
    .optional(),
});

const saveToFrameworkSchema = z.object({
  targetDir: z.string(),
  overwrite: z.boolean().optional(),
});

const analyzeFrameworkSchema = z.object({
  projectPath: z.string(),
});

const listSessionsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  projectId: z.string().uuid().optional(),
  status: z
    .enum([
      'created',
      'input_received',
      'analyzing',
      'transforming',
      'reviewing',
      'completed',
      'failed',
    ])
    .optional(),
  inputMethod: z
    .enum(['record', 'upload', 'screenshot', 'describe', 'edit'])
    .optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/scriptsmith/sessions - Create new session
 */
router.post(
  '/sessions',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const data = validate(createSessionSchema, req.body);

    const session = await scriptSmithSessionService.create({
      userId: authReq.user.userId,
      projectId: data.projectId ?? undefined,
      inputMethod: data.inputMethod,
      projectPath: data.projectPath ?? undefined,
      deviceType: data.deviceType ?? undefined,
      deviceConfig: data.deviceConfig ? (data.deviceConfig as Record<string, unknown>) : undefined,
    });

    res.status(201).json({
      message: 'Session created',
      data: session,
    });
  })
);

/**
 * GET /api/scriptsmith/sessions - List user sessions
 */
router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const query = validate(listSessionsQuerySchema, req.query);

    const result = await scriptSmithSessionService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      userId: authReq.user.userId,
      projectId: query.projectId ?? undefined,
      status: query.status ?? undefined,
      inputMethod: query.inputMethod ?? undefined,
    });

    res.json({ data: result });
  })
);

/**
 * GET /api/scriptsmith/sessions/:id - Get session details
 */
router.get(
  '/sessions/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const session = await scriptSmithSessionService.findByIdWithFiles(id);
    res.json({ data: session });
  })
);

/**
 * POST /api/scriptsmith/sessions/:id/input - Update session input
 */
router.post(
  '/sessions/:id/input',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = validate(updateInputSchema, req.body);

    const session = await scriptSmithSessionService.updateInput(id, data);

    res.json({
      message: 'Input updated',
      data: session,
    });
  })
);

/**
 * POST /api/scriptsmith/sessions/:id/transform - Transform with AI
 */
router.post(
  '/sessions/:id/transform',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = validate(transformSchema, req.body);

    const session = await scriptSmithSessionService.transform(
      id,
      data.options || {},
      data.projectId
    );

    res.json({
      message: 'Transformation complete',
      data: session,
    });
  })
);

/**
 * POST /api/scriptsmith/sessions/:id/save - Save to framework
 */
router.post(
  '/sessions/:id/save',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = validate(saveToFrameworkSchema, req.body);

    const safeTargetDir = sanitizePath(data.targetDir);
    const result = await scriptSmithSessionService.saveToFramework(
      id,
      safeTargetDir,
      data.overwrite
    );

    res.json({
      message: 'Files saved successfully',
      data: result,
    });
  })
);

/**
 * DELETE /api/scriptsmith/sessions/:id - Delete session
 */
router.delete(
  '/sessions/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await scriptSmithSessionService.delete(id);
    res.json({ message: 'Session deleted' });
  })
);

/**
 * POST /api/scriptsmith/analyze-framework - Analyze project structure
 */
router.post(
  '/analyze-framework',
  asyncHandler(async (req, res) => {
    const data = validate(analyzeFrameworkSchema, req.body);

    const safeProjectPath = sanitizePath(data.projectPath);
    const analysis = await scriptSmithSessionService.analyzeFramework(
      safeProjectPath
    );

    res.json({
      message: 'Framework analysis complete',
      data: analysis,
    });
  })
);

export default router;
