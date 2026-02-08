/**
 * Device Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { deviceService } from '../services/device.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

const deviceTypeEnum = z.enum(['browser', 'mobile', 'tablet']);

const createSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  type: deviceTypeEnum,
  config: z.record(z.unknown()),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: deviceTypeEnum.optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const type = req.query.type as 'browser' | 'mobile' | 'tablet' | undefined;
  const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
  const result = await deviceService.findAll({ page, limit, projectId, type, isActive });
  res.json({ data: result });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const device = await deviceService.findById(req.params.id as string);
  res.json({ data: device });
}));

router.post('/', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(createSchema, req.body);
  const device = await deviceService.create(data);
  res.status(201).json({ message: 'Device created', data: device });
}));

router.patch('/:id', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(updateSchema, req.body);
  const device = await deviceService.update(req.params.id as string, data);
  res.json({ message: 'Device updated', data: device });
}));

router.delete('/:id', authorize(['admin']), asyncHandler(async (req, res) => {
  await deviceService.delete(req.params.id as string);
  res.json({ message: 'Device deleted' });
}));

router.get('/project/:projectId', asyncHandler(async (req, res) => {
  const devices = await deviceService.getByProject(req.params.projectId as string);
  res.json({ data: devices });
}));

router.get('/project/:projectId/active', asyncHandler(async (req, res) => {
  const devices = await deviceService.getActiveByProject(req.params.projectId as string);
  res.json({ data: devices });
}));

export default router;
