/**
 * AI Usage Tracking Routes
 */

import { Router } from 'express';
import { aiUsageService } from '../../services/aiusage.service.js';
import { authorize } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { parsePagination } from '../../utils/request-helpers.js';

const router = Router();

router.get('/usage', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req, { limit: 20 });
  const projectId = req.query.projectId as string | undefined;
  const agent = req.query.agent as string | undefined;

  const result = await aiUsageService.findAll({ page, limit, projectId, agent });
  res.json({ data: result });
}));

router.get('/usage/summary/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const summary = await aiUsageService.getProjectSummary(projectId, startDate, endDate);
  res.json({ data: summary });
}));

router.get('/usage/daily/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const projectId = req.params.projectId as string;
  const days = parseInt(req.query.days as string) || 30;

  const dailyCosts = await aiUsageService.getDailyCosts(projectId, days);
  res.json({ data: dailyCosts });
}));

export default router;
