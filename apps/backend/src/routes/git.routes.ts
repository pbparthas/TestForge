/**
 * Git Integration Routes
 * Git integration CRUD, file locks, sync, diff, history
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { gitService } from '../services/git.service.js';
import { fileLockService } from '../services/file-lock.service.js';
import { syncService } from '../services/sync.service.js';
import { prisma } from '../utils/prisma.js';
import { ValidationError } from '../errors/index.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// HELPERS
// =============================================================================

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
    );
  }
  return result.data;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createIntegrationSchema = z.object({
  projectId: z.string().uuid(),
  repositoryUrl: z.string().min(1),
  sshKey: z.string().min(1),
  defaultBranch: z.string().optional(),
  developBranch: z.string().optional(),
});

const testConnectionSchema = z.object({
  repositoryUrl: z.string().min(1),
  sshKey: z.string().min(1),
});

const acquireLockSchema = z.object({
  integrationId: z.string().uuid(),
  scriptId: z.string().uuid(),
  filePath: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
});

const syncToGitSchema = z.object({
  scriptId: z.string().uuid(),
  commitMessage: z.string().optional(),
});

const syncFromGitSchema = z.object({
  projectId: z.string().uuid(),
  filePaths: z.array(z.string()).optional(),
});

const extendLockSchema = z.object({
  minutes: z.number().int().positive().default(30),
});

// =============================================================================
// INTEGRATION CRUD
// =============================================================================

router.post(
  '/integrations',
  authorize(['admin', 'lead']),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = validate(createIntegrationSchema, req.body);
    const integration = await gitService.createIntegration({
      ...data,
      createdById: authReq.user!.userId,
    });
    res.status(201).json({ message: 'Integration created', data: integration });
  })
);

router.get(
  '/integrations/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const integration = await gitService.getIntegration(req.params.projectId);
    // Strip sshKeyEncrypted from response
    const { sshKeyEncrypted, ...safe } = integration;
    res.json({ data: safe });
  })
);

router.post(
  '/integrations/:id/test',
  authorize(['admin', 'lead']),
  asyncHandler(async (req: Request, res: Response) => {
    const data = validate(testConnectionSchema, req.body);
    const result = await gitService.testConnection(data.repositoryUrl, data.sshKey);
    res.json({ data: result });
  })
);

// =============================================================================
// FILE LOCKS
// =============================================================================

router.post(
  '/locks/acquire',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = validate(acquireLockSchema, req.body);
    const lock = await fileLockService.acquireLock({
      ...data,
      userId: authReq.user!.userId,
    });
    res.json({ data: lock });
  })
);

router.post(
  '/locks/:lockId/release',
  asyncHandler(async (req: Request, res: Response) => {
    const lock = await fileLockService.releaseLock(req.params.lockId);
    res.json({ message: 'Lock released', data: lock });
  })
);

router.get(
  '/locks/check/:scriptId',
  asyncHandler(async (req: Request, res: Response) => {
    const lock = await fileLockService.checkLock(req.params.scriptId);
    res.json({ data: lock });
  })
);

router.post(
  '/locks/:lockId/extend',
  asyncHandler(async (req: Request, res: Response) => {
    const data = validate(extendLockSchema, req.body);
    const lock = await fileLockService.extendLock(req.params.lockId, data.minutes);
    res.json({ data: lock });
  })
);

router.post(
  '/locks/:scriptId/force',
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const lock = await fileLockService.forceRelease(req.params.scriptId);
    res.json({ message: 'Lock force released', data: lock });
  })
);

// =============================================================================
// SYNC
// =============================================================================

router.post(
  '/sync/to-git',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = validate(syncToGitSchema, req.body);
    const result = await syncService.syncScriptToGit({
      ...data,
      userId: authReq.user!.userId,
    });
    res.json({ data: result });
  })
);

router.post(
  '/sync/from-git',
  asyncHandler(async (req: Request, res: Response) => {
    const data = validate(syncFromGitSchema, req.body);
    const result = await syncService.syncFilesFromGit(data);
    res.json({ data: result });
  })
);

// =============================================================================
// DIFF & HISTORY
// =============================================================================

router.get(
  '/diff/:scriptId',
  asyncHandler(async (req: Request, res: Response) => {
    const diff = await gitService.getDiff(req.params.scriptId, {
      filePath: (req.query.filePath as string) || '',
      source: (req.query.source as string) || 'main',
      target: (req.query.target as string) || 'develop',
    });
    res.json({ data: diff });
  })
);

router.get(
  '/history/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const maxCount = req.query.maxCount ? parseInt(req.query.maxCount as string, 10) : 50;
    const log = await gitService.getLog(req.params.projectId, { maxCount });
    res.json({ data: log });
  })
);

// =============================================================================
// REVIEW COMMENTS
// =============================================================================

const addCommentSchema = z.object({
  scriptId: z.string().uuid().optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  content: z.string().min(1),
});

router.post(
  '/reviews/:artifactId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = validate(addCommentSchema, req.body);
    const comment = await prisma.reviewComment.create({
      data: {
        artifactId: req.params.artifactId,
        userId: authReq.user!.userId,
        ...data,
      },
    });
    res.status(201).json({ data: comment });
  })
);

router.get(
  '/reviews/:artifactId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const comments = await prisma.reviewComment.findMany({
      where: { artifactId: req.params.artifactId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: comments });
  })
);

router.patch(
  '/reviews/comments/:id/resolve',
  asyncHandler(async (req: Request, res: Response) => {
    const comment = await prisma.reviewComment.update({
      where: { id: req.params.id },
      data: { isResolved: true },
    });
    res.json({ data: comment });
  })
);

export default router;
