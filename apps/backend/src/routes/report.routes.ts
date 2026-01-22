/**
 * Report Routes
 * Generate, manage, and download reports
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reportService } from '../services/report.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import fs from 'fs';

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

// Schemas
const reportParametersSchema = z.object({
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }).optional(),
  suiteIds: z.array(z.string().uuid()).optional(),
  environmentIds: z.array(z.string().uuid()).optional(),
  includeFlaky: z.boolean().optional(),
  includeCoverage: z.boolean().optional(),
  includeTrends: z.boolean().optional(),
  trendDays: z.number().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

const generateReportSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['execution_summary', 'coverage', 'flaky_analysis', 'trend', 'ai_cost', 'custom']),
  format: z.enum(['pdf', 'excel', 'json']).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  executionId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  parameters: reportParametersSchema.optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  type: z.enum(['summary', 'chart', 'table', 'text', 'coverage_matrix', 'flaky_list', 'trend_graph']),
  title: z.string(),
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
});

const templateConfigSchema = z.object({
  sections: z.array(sectionSchema),
  filters: z.object({
    excludeSkipped: z.boolean().optional(),
    minPassRate: z.number().optional(),
    maxFlakiness: z.number().optional(),
    testTypes: z.array(z.string()).optional(),
    priorities: z.array(z.string()).optional(),
  }).optional(),
  styling: z.object({
    logo: z.string().optional(),
    primaryColor: z.string().optional(),
    showPageNumbers: z.boolean().optional(),
    showTimestamp: z.boolean().optional(),
  }).optional(),
});

const createTemplateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['execution_summary', 'coverage', 'flaky_analysis', 'trend', 'ai_cost', 'custom']),
  config: templateConfigSchema,
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: templateConfigSchema.optional(),
  isDefault: z.boolean().optional(),
});

const createScheduleSchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1).max(100),
  cronExpression: z.string().regex(/^(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)$/),
  timezone: z.string().optional(),
  format: z.enum(['pdf', 'excel', 'json']).optional(),
  parameters: reportParametersSchema.optional(),
  recipients: z.array(z.string().email()).optional(),
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cronExpression: z.string().regex(/^(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)\s+(\*|[0-9,-\/]+)$/).optional(),
  timezone: z.string().optional(),
  format: z.enum(['pdf', 'excel', 'json']).optional(),
  parameters: reportParametersSchema.optional(),
  recipients: z.array(z.string().email()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// REPORT ROUTES
// ============================================================================

// List reports
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const type = req.query.type as 'execution_summary' | 'coverage' | 'flaky_analysis' | 'trend' | 'ai_cost' | 'custom' | undefined;
  const status = req.query.status as 'pending' | 'generating' | 'completed' | 'failed' | undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const result = await reportService.findAll({ page, limit, projectId, type, status, startDate, endDate });
  res.json({ data: result });
}));

// Get report by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const report = await reportService.findById(req.params.id);
  res.json({ data: report });
}));

// Download report
router.get('/:id/download', asyncHandler(async (req, res) => {
  const { filePath, fileName, mimeType } = await reportService.download(req.params.id);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}));

// Generate report
router.post('/generate', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(generateReportSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const report = await reportService.generate({ ...data, createdById: user.id });
  res.status(201).json({ message: 'Report generation started', data: report });
}));

// Delete report
router.delete('/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  await reportService.delete(req.params.id);
  res.json({ message: 'Report deleted' });
}));

// ============================================================================
// TEMPLATE ROUTES
// ============================================================================

// List templates
router.get('/templates', asyncHandler(async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    throw new ValidationError('Validation failed', [{ field: 'projectId', message: 'Required' }]);
  }
  const templates = await reportService.findTemplates(projectId);
  res.json({ data: templates });
}));

// Get template by ID
router.get('/templates/:id', asyncHandler(async (req, res) => {
  const template = await reportService.findTemplateById(req.params.id);
  res.json({ data: template });
}));

// Create template
router.post('/templates', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(createTemplateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const template = await reportService.createTemplate({ ...data, createdById: user.id });
  res.status(201).json({ message: 'Template created', data: template });
}));

// Update template
router.put('/templates/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(updateTemplateSchema, req.body);
  const template = await reportService.updateTemplate(req.params.id, data);
  res.json({ message: 'Template updated', data: template });
}));

// Delete template
router.delete('/templates/:id', authorize(['admin']), asyncHandler(async (req, res) => {
  await reportService.deleteTemplate(req.params.id);
  res.json({ message: 'Template deleted' });
}));

// ============================================================================
// SCHEDULE ROUTES
// ============================================================================

// List schedules
router.get('/schedules', asyncHandler(async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    throw new ValidationError('Validation failed', [{ field: 'projectId', message: 'Required' }]);
  }
  const schedules = await reportService.findSchedules(projectId);
  res.json({ data: schedules });
}));

// Get schedule by ID
router.get('/schedules/:id', asyncHandler(async (req, res) => {
  const schedule = await reportService.findScheduleById(req.params.id);
  res.json({ data: schedule });
}));

// Create schedule
router.post('/schedules', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(createScheduleSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const schedule = await reportService.createSchedule({ ...data, createdById: user.id });
  res.status(201).json({ message: 'Schedule created', data: schedule });
}));

// Update schedule
router.put('/schedules/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(updateScheduleSchema, req.body);
  const schedule = await reportService.updateSchedule(req.params.id, data);
  res.json({ message: 'Schedule updated', data: schedule });
}));

// Delete schedule
router.delete('/schedules/:id', authorize(['admin']), asyncHandler(async (req, res) => {
  await reportService.deleteSchedule(req.params.id);
  res.json({ message: 'Schedule deleted' });
}));

// Manually trigger scheduled report
router.post('/schedules/:id/run', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const schedule = await reportService.findScheduleById(req.params.id);
  const report = await reportService.generate({
    projectId: schedule.projectId,
    type: (schedule as { template: { type: 'execution_summary' | 'coverage' | 'flaky_analysis' | 'trend' | 'ai_cost' | 'custom' } }).template.type,
    format: schedule.format,
    templateId: schedule.templateId,
    parameters: schedule.parameters as Parameters<typeof reportService.generate>[0]['parameters'],
  });
  res.status(201).json({ message: 'Scheduled report triggered', data: report });
}));

export default router;
