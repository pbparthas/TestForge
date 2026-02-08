/**
 * Jenkins Integration Routes
 * Sprint 15: CI/CD integration for automated test execution
 *
 * Routes:
 * - POST /api/jenkins/integrations - Create new integration
 * - GET /api/jenkins/integrations/:projectId - Get project integrations
 * - GET /api/jenkins/integration/:id - Get single integration
 * - PUT /api/jenkins/integration/:id - Update integration
 * - DELETE /api/jenkins/integration/:id - Delete integration
 * - POST /api/jenkins/test-connection - Test Jenkins connection
 * - POST /api/jenkins/integration/:id/trigger - Trigger a build
 * - GET /api/jenkins/integration/:id/builds - Get build history
 * - GET /api/jenkins/build/:id - Get single build
 * - POST /api/jenkins/build/:id/poll - Poll build status
 * - GET /api/jenkins/build/:id/console - Get console log
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { jenkinsService } from '../services/jenkins.service.js';
import { ValidationError } from '../errors/index.js';
import { validate } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);

// =============================================================================
// HELPERS
// =============================================================================
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createIntegrationSchema = z.object({
  projectId: z.string().uuid(),
  integrationName: z.string().min(1).max(100),
  serverUrl: z.string().url(),
  username: z.string().min(1),
  apiToken: z.string().min(1),
  jobPath: z.string().min(1),
  defaultEnvironment: z.string().optional(),
  defaultBrowser: z.string().optional(),
  buildParameters: z.record(z.unknown()).optional(),
});

const updateIntegrationSchema = z.object({
  integrationName: z.string().min(1).max(100).optional(),
  serverUrl: z.string().url().optional(),
  username: z.string().min(1).optional(),
  apiToken: z.string().min(1).optional(),
  jobPath: z.string().min(1).optional(),
  defaultEnvironment: z.string().optional(),
  defaultBrowser: z.string().optional(),
  buildParameters: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const testConnectionSchema = z.object({
  serverUrl: z.string().url(),
  username: z.string().min(1),
  apiToken: z.string().min(1),
});

const triggerBuildSchema = z.object({
  environment: z.string().optional(),
  browser: z.string().optional(),
  testSuiteId: z.string().uuid().optional(),
  testCaseIds: z.array(z.string().uuid()).optional(),
  customParams: z.record(z.string()).optional(),
  executionId: z.string().uuid().optional(),
});

const getBuildsQuerySchema = z.object({
  status: z.enum(['pending', 'building', 'success', 'failure', 'aborted']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

const getIntegrationsQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});

// =============================================================================
// INTEGRATION CRUD ROUTES
// =============================================================================

/**
 * POST /api/jenkins/integrations - Create new integration
 */
router.post(
  '/integrations',
  authorize(['admin', 'lead']),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const data = validate(createIntegrationSchema, req.body);

    const integration = await jenkinsService.createIntegration({
      ...data,
      createdById: authReq.user.userId,
    });

    res.status(201).json({
      message: 'Integration created',
      data: integration,
    });
  })
);

/**
 * GET /api/jenkins/integrations/:projectId - Get project integrations
 */
router.get(
  '/integrations/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const query = validate(getIntegrationsQuerySchema, req.query);

    const integrations = await jenkinsService.getProjectIntegrations(
      projectId,
      { isActive: query.isActive }
    );

    res.json({
      data: integrations,
      total: integrations.length,
    });
  })
);

/**
 * GET /api/jenkins/integration/:id - Get single integration
 */
router.get(
  '/integration/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const integration = await jenkinsService.getIntegration(id);

    // Remove encrypted token from response
    const { apiTokenEncrypted, ...safeIntegration } = integration;

    res.json({ data: safeIntegration });
  })
);

/**
 * PUT /api/jenkins/integration/:id - Update integration
 */
router.put(
  '/integration/:id',
  authorize(['admin', 'lead']),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = validate(updateIntegrationSchema, req.body);

    const integration = await jenkinsService.updateIntegration(id, data);

    // Remove encrypted token from response
    const { apiTokenEncrypted, ...safeIntegration } = integration;

    res.json({
      message: 'Integration updated',
      data: safeIntegration,
    });
  })
);

/**
 * DELETE /api/jenkins/integration/:id - Delete integration
 */
router.delete(
  '/integration/:id',
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    await jenkinsService.deleteIntegration(id);

    res.json({ message: 'Integration deleted' });
  })
);

// =============================================================================
// CONNECTION TEST
// =============================================================================

/**
 * POST /api/jenkins/test-connection - Test Jenkins connection
 */
router.post(
  '/test-connection',
  asyncHandler(async (req, res) => {
    const data = validate(testConnectionSchema, req.body);

    const result = await jenkinsService.testConnection(data);

    res.json({
      message: result.success ? 'Connection successful' : 'Connection failed',
      data: result,
    });
  })
);

// =============================================================================
// BUILD MANAGEMENT ROUTES
// =============================================================================

/**
 * POST /api/jenkins/integration/:id/trigger - Trigger a build
 */
router.post(
  '/integration/:id/trigger',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = validate(triggerBuildSchema, req.body);

    const build = await jenkinsService.triggerBuild(
      id,
      {
        environment: data.environment,
        browser: data.browser,
        testSuiteId: data.testSuiteId,
        testCaseIds: data.testCaseIds,
        customParams: data.customParams,
      },
      data.executionId
    );

    res.status(201).json({
      message: 'Build triggered',
      data: build,
    });
  })
);

/**
 * GET /api/jenkins/integration/:id/builds - Get build history
 */
router.get(
  '/integration/:id/builds',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const query = validate(getBuildsQuerySchema, req.query);

    const result = await jenkinsService.getIntegrationBuilds(id, {
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });

    res.json({
      data: result.data,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    });
  })
);

/**
 * GET /api/jenkins/build/:id - Get single build
 */
router.get(
  '/build/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const build = await jenkinsService.getBuild(id);

    res.json({ data: build });
  })
);

/**
 * POST /api/jenkins/build/:id/poll - Poll build status from Jenkins
 */
router.post(
  '/build/:id/poll',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const build = await jenkinsService.pollBuildStatus(id);

    res.json({
      message: 'Build status updated',
      data: build,
    });
  })
);

/**
 * GET /api/jenkins/build/:id/console - Get console log
 */
router.get(
  '/build/:id/console',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const consoleLog = await jenkinsService.getConsoleLog(id);

    res.json({
      data: { log: consoleLog },
    });
  })
);

export default router;
