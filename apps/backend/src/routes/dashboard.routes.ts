/**
 * Dashboard Routes
 * Handles executive dashboard endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { dashboardService } from '../services/dashboard.service.js';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const getMetricsSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().optional(),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
  startDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const recordMetricSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['count', 'percentage', 'duration', 'score', 'trend']),
  value: z.number(),
  previousValue: z.number().optional(),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  periodStart: z.string().datetime().transform(v => new Date(v)),
  periodEnd: z.string().datetime().transform(v => new Date(v)),
  metadata: z.record(z.unknown()).optional(),
});

const trendDataSchema = z.object({
  name: z.string().min(1, 'Metric name is required'),
  projectId: z.string().uuid().optional(),
  days: z.coerce.number().int().positive().max(365).default(30),
});

// =============================================================================
// HELPERS
// =============================================================================

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// DASHBOARD DATA ROUTES
// =============================================================================

/**
 * GET /api/dashboard
 * Get complete dashboard data
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const days = parseInt(req.query.days as string) || 30;

  const data = await dashboardService.generateDashboardData(projectId, days);

  res.json({ data });
}));

/**
 * GET /api/dashboard/global
 * Get global summary across all projects
 */
router.get('/global', asyncHandler(async (req: Request, res: Response) => {
  const summary = await dashboardService.getGlobalSummary();
  res.json({ data: summary });
}));

/**
 * GET /api/dashboard/pass-rate
 * Get pass rate metric
 */
router.get('/pass-rate', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const days = parseInt(req.query.days as string) || 30;

  const passRate = await dashboardService.calculatePassRate(projectId, days);

  res.json({ data: { passRate, days } });
}));

/**
 * GET /api/dashboard/test-coverage
 * Get test coverage metric
 */
router.get('/test-coverage', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  const testCoverage = await dashboardService.calculateTestCoverage(projectId);

  res.json({ data: { testCoverage } });
}));

/**
 * GET /api/dashboard/flakiness
 * Get flakiness score
 */
router.get('/flakiness', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  const flakinessScore = await dashboardService.calculateFlakinessScore(projectId);

  res.json({ data: { flakinessScore } });
}));

/**
 * GET /api/dashboard/executions
 * Get execution summary
 */
router.get('/executions', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const days = parseInt(req.query.days as string) || 30;

  const summary = await dashboardService.getExecutionSummary(projectId, days);

  res.json({ data: summary });
}));

/**
 * GET /api/dashboard/ai-costs
 * Get AI cost summary
 */
router.get('/ai-costs', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const days = parseInt(req.query.days as string) || 30;

  const summary = await dashboardService.getAICostSummary(projectId, days);

  res.json({ data: summary });
}));

// =============================================================================
// METRIC ROUTES
// =============================================================================

/**
 * GET /api/dashboard/metrics
 * Get metrics with filters
 */
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const params = validate(getMetricsSchema, req.query);

  const metrics = await dashboardService.getMetrics(params);

  res.json({ data: metrics });
}));

/**
 * GET /api/dashboard/metrics/:name
 * Get latest metric by name
 */
router.get('/metrics/:name', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  const metric = await dashboardService.getMetricByName(req.params.name, projectId);

  res.json({ data: metric });
}));

/**
 * POST /api/dashboard/metrics
 * Record a metric (admin/lead only)
 */
router.post('/metrics', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const data = validate(recordMetricSchema, req.body);

  const metric = await dashboardService.recordMetric(data);

  res.status(201).json({
    message: 'Metric recorded successfully',
    data: metric,
  });
}));

/**
 * GET /api/dashboard/trend
 * Get trend data for a metric
 */
router.get('/trend', asyncHandler(async (req: Request, res: Response) => {
  const params = validate(trendDataSchema, req.query);

  const trendData = await dashboardService.getTrendData(
    params.name,
    params.projectId,
    params.days
  );

  res.json({ data: trendData });
}));

// =============================================================================
// SNAPSHOT ROUTES
// =============================================================================

/**
 * GET /api/dashboard/snapshots
 * Get dashboard snapshots
 */
router.get('/snapshots', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const limit = parseInt(req.query.limit as string) || 10;

  const snapshots = await dashboardService.getSnapshots(projectId, limit);

  res.json({ data: snapshots });
}));

/**
 * GET /api/dashboard/snapshots/latest
 * Get latest dashboard snapshot
 */
router.get('/snapshots/latest', asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  const snapshot = await dashboardService.getLatestSnapshot(projectId);

  res.json({ data: snapshot });
}));

/**
 * GET /api/dashboard/snapshots/:id
 * Get snapshot by ID
 */
router.get('/snapshots/:id', asyncHandler(async (req: Request, res: Response) => {
  const snapshot = await dashboardService.getSnapshotById(req.params.id);
  res.json({ data: snapshot });
}));

/**
 * POST /api/dashboard/snapshots
 * Create a dashboard snapshot
 */
router.post('/snapshots', authorize(['admin', 'lead']), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const projectId = req.body.projectId as string | undefined;

  const snapshot = await dashboardService.generateAndSaveSnapshot(projectId, userId);

  res.status(201).json({
    message: 'Snapshot created successfully',
    data: snapshot,
  });
}));

// =============================================================================
// MAINTENANCE ROUTES
// =============================================================================

/**
 * POST /api/dashboard/record-daily
 * Record daily metrics for a project (admin only)
 */
router.post('/record-daily', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.body.projectId as string;

  if (!projectId) {
    throw new ValidationError('Project ID is required', [{ field: 'projectId', message: 'Required' }]);
  }

  await dashboardService.recordDailyMetrics(projectId);

  res.json({
    message: 'Daily metrics recorded successfully',
  });
}));

/**
 * POST /api/dashboard/cleanup
 * Cleanup old metrics and snapshots (admin only)
 */
router.post('/cleanup', authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const retentionDays = parseInt(req.body.retentionDays as string) || 90;

  const [metricsDeleted, snapshotsDeleted] = await Promise.all([
    dashboardService.cleanupOldMetrics(retentionDays),
    dashboardService.cleanupOldSnapshots(retentionDays),
  ]);

  res.json({
    message: 'Cleanup completed successfully',
    data: { metricsDeleted, snapshotsDeleted },
  });
}));

export default router;
