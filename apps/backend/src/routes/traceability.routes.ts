/**
 * Traceability Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { traceabilityService } from '../services/traceability.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/coverage/:projectId', asyncHandler(async (req, res) => {
  const coverage = await traceabilityService.getProjectCoverage(req.params.projectId as string);
  res.json({ data: coverage });
}));

router.get('/requirements/:projectId', asyncHandler(async (req, res) => {
  const coverage = await traceabilityService.getRequirementCoverage(req.params.projectId as string);
  res.json({ data: coverage });
}));

router.get('/chain/:requirementId', asyncHandler(async (req, res) => {
  const chain = await traceabilityService.getTraceabilityChain(req.params.requirementId as string);
  res.json({ data: chain });
}));

router.get('/gaps/:projectId', asyncHandler(async (req, res) => {
  const gaps = await traceabilityService.getCoverageGaps(req.params.projectId as string);
  res.json({ data: gaps });
}));

export default router;
