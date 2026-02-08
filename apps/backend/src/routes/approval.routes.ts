/**
 * Approval Routes
 * API endpoints for HITL approval workflows
 * Sprint 18: HITL Approval Workflows
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { approvalService } from '../services/approval.service.js';
import { riskAssessmentService } from '../services/risk-assessment.service.js';
import { slaService } from '../services/sla.service.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// ============================================================================
// UTILITIES
// ============================================================================

// ============================================================================
// SCHEMAS
// ============================================================================

const createArtifactSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['test_case', 'script', 'bug_analysis', 'chat_suggestion', 'self_healing_fix']),
  sourceAgent: z.string().min(1),
  sourceSessionId: z.string().optional(),
  sourceType: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
  aiConfidenceScore: z.number().min(0).max(100).optional(),
  targetEntityType: z.string().optional(),
  targetEntityId: z.string().uuid().optional(),
});

const updateArtifactSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  content: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const feedbackSchema = z.object({
  category: z.enum(['accuracy', 'incomplete', 'style_violation', 'security_concern', 'performance', 'scope_creep', 'duplicate', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
  suggestedFix: z.string().optional(),
  affectedSection: z.string().optional(),
  correctedContent: z.string().optional(),
});

const rejectSchema = z.object({
  comment: z.string().optional(),
  feedback: z.array(feedbackSchema).optional(),
});

const reviseSchema = z.object({
  content: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

const approveSchema = z.object({
  comment: z.string().optional(),
});

const escalateSchema = z.object({
  escalatedToId: z.string().uuid(),
  reason: z.string().min(1),
});

const settingsSchema = z.object({
  lowRiskThreshold: z.number().min(0).max(100).optional(),
  mediumRiskThreshold: z.number().min(0).max(100).optional(),
  highRiskThreshold: z.number().min(0).max(100).optional(),
  lowRiskSlaHours: z.number().min(1).max(168).optional(),
  mediumRiskSlaHours: z.number().min(1).max(168).optional(),
  highRiskSlaHours: z.number().min(1).max(168).optional(),
  criticalRiskSlaHours: z.number().min(1).max(168).optional(),
  autoApproveEnabled: z.boolean().optional(),
  autoApproveMaxRisk: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  autoApproveMinConfidence: z.number().min(0).max(100).optional(),
  notifyOnSubmission: z.boolean().optional(),
  notifyOnApproval: z.boolean().optional(),
  notifyOnRejection: z.boolean().optional(),
  notifyOnSlaWarning: z.boolean().optional(),
  escalationEnabled: z.boolean().optional(),
  escalationChain: z.array(z.string().uuid()).optional(),
});

// ============================================================================
// ARTIFACT ROUTES
// ============================================================================

// List artifacts
router.get('/artifacts', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const type = req.query.type as string | undefined;
  const state = req.query.state as string | undefined;
  const riskLevel = req.query.riskLevel as string | undefined;

  const result = await approvalService.findAll({
    page,
    limit,
    projectId,
    type: type as 'test_case' | 'script' | 'bug_analysis' | 'chat_suggestion' | 'self_healing_fix' | undefined,
    state: state as 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'archived' | undefined,
    riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical' | undefined,
  });

  res.json({ data: result });
}));

// Create artifact
router.post('/artifacts', asyncHandler(async (req, res) => {
  const data = validate(createArtifactSchema, req.body);
  const user = (req as Request & { user: { userId: string } }).user;

  const artifact = await approvalService.create({
    ...data,
    createdById: user.userId,
  });

  res.status(201).json({ message: 'Artifact created', data: artifact });
}));

// Get artifact by ID
router.get('/artifacts/:id', asyncHandler(async (req, res) => {
  const artifact = await approvalService.findById(req.params.id);
  res.json({ data: artifact });
}));

// Update artifact
router.put('/artifacts/:id', asyncHandler(async (req, res) => {
  const data = validate(updateArtifactSchema, req.body);
  const artifact = await approvalService.update(req.params.id, data);
  res.json({ message: 'Artifact updated', data: artifact });
}));

// Delete artifact
router.delete('/artifacts/:id', asyncHandler(async (req, res) => {
  await approvalService.delete(req.params.id);
  res.json({ message: 'Artifact deleted' });
}));

// ============================================================================
// WORKFLOW ACTION ROUTES
// ============================================================================

// Submit for review
router.post('/artifacts/:id/submit', asyncHandler(async (req, res) => {
  const user = (req as Request & { user: { userId: string } }).user;
  const artifact = await approvalService.submitForReview({
    artifactId: req.params.id,
    userId: user.userId,
  });
  res.json({ message: 'Artifact submitted for review', data: artifact });
}));

// Claim for review
router.post('/artifacts/:id/claim', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const user = (req as Request & { user: { userId: string } }).user;
  const artifact = await approvalService.claimReview({
    artifactId: req.params.id,
    userId: user.userId,
  });
  res.json({ message: 'Artifact claimed for review', data: artifact });
}));

// Approve
router.post('/artifacts/:id/approve', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = req.body ? validate(approveSchema, req.body) : {};
  const user = (req as Request & { user: { userId: string } }).user;
  const artifact = await approvalService.approve({
    artifactId: req.params.id,
    userId: user.userId,
    comment: data.comment,
  });
  res.json({ message: 'Artifact approved', data: artifact });
}));

// Reject
router.post('/artifacts/:id/reject', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const data = validate(rejectSchema, req.body);
  const user = (req as Request & { user: { userId: string } }).user;
  const artifact = await approvalService.reject({
    artifactId: req.params.id,
    userId: user.userId,
    comment: data.comment,
    feedback: data.feedback,
  });
  res.json({ message: 'Artifact rejected', data: artifact });
}));

// Revise
router.post('/artifacts/:id/revise', asyncHandler(async (req, res) => {
  const data = validate(reviseSchema, req.body);
  const user = (req as Request & { user: { userId: string } }).user;
  const artifact = await approvalService.revise({
    artifactId: req.params.id,
    userId: user.userId,
    content: data.content,
    metadata: data.metadata,
  });
  res.json({ message: 'Artifact revised', data: artifact });
}));

// Archive
router.post('/artifacts/:id/archive', asyncHandler(async (req, res) => {
  const user = (req as Request & { user: { userId: string } }).user;
  const artifact = await approvalService.archive(req.params.id, user.userId);
  res.json({ message: 'Artifact archived', data: artifact });
}));

// Get artifact history
router.get('/artifacts/:id/history', asyncHandler(async (req, res) => {
  const history = await approvalService.getHistory(req.params.id);
  res.json({ data: history });
}));

// Get artifact feedback
router.get('/artifacts/:id/feedback', asyncHandler(async (req, res) => {
  const feedback = await approvalService.getFeedback(req.params.id);
  res.json({ data: feedback });
}));

// ============================================================================
// REVIEW QUEUE ROUTES
// ============================================================================

// Get review queue
router.get('/queue', authorize(['admin', 'lead', 'qae']), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;
  const type = req.query.type as string | undefined;
  const riskLevel = req.query.riskLevel as string | undefined;

  const result = await approvalService.getReviewQueue({
    page,
    limit,
    projectId,
    type: type as 'test_case' | 'script' | 'bug_analysis' | 'chat_suggestion' | 'self_healing_fix' | undefined,
    riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical' | undefined,
  });

  res.json({ data: result });
}));

// ============================================================================
// SLA ROUTES
// ============================================================================

// Get SLA status for artifact
router.get('/sla/:artifactId', asyncHandler(async (req, res) => {
  const status = await slaService.getSLAStatus(req.params.artifactId);
  res.json({ data: status });
}));

// Get approaching SLAs
router.get('/sla/approaching', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;

  const result = await slaService.getApproachingSLAs(projectId, page, limit);
  res.json({ data: result });
}));

// Get breached SLAs
router.get('/sla/breached', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const projectId = req.query.projectId as string | undefined;

  const result = await slaService.getBreachedSLAs(projectId, page, limit);
  res.json({ data: result });
}));

// Escalate SLA
router.post('/sla/:artifactId/escalate', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(escalateSchema, req.body);
  const sla = await slaService.escalate({
    artifactId: req.params.artifactId,
    escalatedToId: data.escalatedToId,
    reason: data.reason,
  });
  res.json({ message: 'SLA escalated', data: sla });
}));

// Get SLA metrics
router.get('/sla/metrics/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const metrics = await slaService.getSLAMetrics(req.params.projectId, days);
  res.json({ data: metrics });
}));

// ============================================================================
// SETTINGS ROUTES
// ============================================================================

// Get project settings
router.get('/settings/:projectId', asyncHandler(async (req, res) => {
  const settings = await riskAssessmentService.getProjectSettings(req.params.projectId);
  res.json({ data: settings });
}));

// Update project settings
router.put('/settings/:projectId', authorize(['admin', 'lead']), asyncHandler(async (req, res) => {
  const data = validate(settingsSchema, req.body);
  const settings = await riskAssessmentService.updateProjectSettings(req.params.projectId, data);
  res.json({ message: 'Settings updated', data: settings });
}));

export default router;
