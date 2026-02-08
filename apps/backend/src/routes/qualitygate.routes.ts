/**
 * Quality Gate Routes
 * Manage quality gates and evaluate executions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { qualityGateService } from '../services/qualitygate.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// Schemas
const conditionSchema = z.object({
  metric: z.enum(['pass_rate', 'coverage', 'flakiness', 'duration', 'failed_count', 'critical_failures']),
  operator: z.enum(['gte', 'lte', 'gt', 'lt', 'eq']),
  threshold: z.number(),
  severity: z.enum(['error', 'warning']).optional(),
  description: z.string().optional(),
});

const createQualityGateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  failOnBreach: z.boolean().optional(),
  conditions: z.array(conditionSchema).min(1),
});

const updateQualityGateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  failOnBreach: z.boolean().optional(),
  conditions: z.array(conditionSchema).optional(),
});

const evaluateSchema = z.object({
  executionId: z.string().uuid(),
  qualityGateId: z.string().uuid().optional(),
});

// Routes

// List quality gates
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

  const result = await qualityGateService.findAll({ page, limit, projectId, isActive });
  res.json({ data: result });
}));

// Get quality gate by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const qualityGate = await qualityGateService.findById(req.params.id);
  res.json({ data: qualityGate });
}));

// Get quality gates by project
router.get('/project/:projectId', asyncHandler(async (req, res) => {
  const qualityGates = await qualityGateService.findByProject(req.params.projectId);
  res.json({ data: qualityGates });
}));

// Get project quality summary
router.get('/project/:projectId/summary', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const summary = await qualityGateService.getProjectSummary(req.params.projectId, days);
  res.json({ data: summary });
}));

// Create quality gate
router.post('/', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(createQualityGateSchema, req.body);
  const user = (req as Request & { user: { id: string } }).user;
  const qualityGate = await qualityGateService.create({ ...data, createdById: user.id });
  res.status(201).json({ message: 'Quality gate created', data: qualityGate });
}));

// Update quality gate
router.put('/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(updateQualityGateSchema, req.body);
  const qualityGate = await qualityGateService.update(req.params.id, data);
  res.json({ message: 'Quality gate updated', data: qualityGate });
}));

// Delete quality gate
router.delete('/:id', authorize(['admin']), asyncHandler(async (req, res) => {
  await qualityGateService.delete(req.params.id);
  res.json({ message: 'Quality gate deleted' });
}));

// Set as default
router.post('/:id/set-default', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const qualityGate = await qualityGateService.setDefault(req.params.id);
  res.json({ message: 'Quality gate set as default', data: qualityGate });
}));

// Evaluate execution against quality gate
router.post('/evaluate', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(evaluateSchema, req.body);
  const result = await qualityGateService.evaluate(data);
  res.json({ message: 'Quality gate evaluated', data: result });
}));

// Get evaluations for an execution
router.get('/evaluations/:executionId', asyncHandler(async (req, res) => {
  const evaluations = await qualityGateService.getExecutionEvaluations(req.params.executionId);
  res.json({ data: evaluations });
}));

export default router;
