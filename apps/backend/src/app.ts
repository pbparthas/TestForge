/**
 * Express App Configuration
 * Sets up middleware, routes, and error handling
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { AppError } from './errors/index.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import testCaseRoutes from './routes/testcase.routes.js';
import testSuiteRoutes from './routes/testsuite.routes.js';
import requirementRoutes from './routes/requirement.routes.js';
import environmentRoutes from './routes/environment.routes.js';
import deviceRoutes from './routes/device.routes.js';
import scriptRoutes from './routes/script.routes.js';
import aiRoutes from './routes/ai.routes.js';
import visualRoutes from './routes/visual.routes.js';
import recorderRoutes from './routes/recorder.routes.js';
import executionRoutes from './routes/execution.routes.js';
import traceabilityRoutes from './routes/traceability.routes.js';
import bugRoutes from './routes/bug.routes.js';
import bugPatternRoutes from './routes/bugpattern.routes.js';
import codeAnalysisRoutes from './routes/codeanalysis.routes.js';
import testEvolutionRoutes from './routes/testevolution.routes.js';
import testPilotRoutes from './routes/testpilot.routes.js';
import scriptSmithSessionRoutes from './routes/scriptsmith-session.routes.js';
import flakyRoutes from './routes/flaky.routes.js';
import duplicateRoutes from './routes/duplicate.routes.js';
import jenkinsRoutes from './routes/jenkins.routes.js';
import chatRoutes from './routes/chat.routes.js';
import helpRoutes from './routes/help.routes.js';
import reportRoutes from './routes/report.routes.js';
import qualityGateRoutes from './routes/qualitygate.routes.js';
import approvalRoutes from './routes/approval.routes.js';
// Sprint 19: Advanced Features
import teamRoutes from './routes/team.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import roleRoutes from './routes/role.routes.js';
import auditRoutes from './routes/audit.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
// Sprint 20: Postman Import & Templates
import postmanRoutes from './routes/postman.routes.js';
import templateRoutes from './routes/template.routes.js';
// MaestroSmith: Maestro YAML flow generation
import maestroRoutes from './routes/maestro.routes.js';

// =============================================================================
// APP SETUP
// =============================================================================

const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

app.use(limiter);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, path: req.path }, 'Request');
  next();
});

// =============================================================================
// ROUTES
// =============================================================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/test-cases', testCaseRoutes);
app.use('/api/test-suites', testSuiteRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/environments', environmentRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/visual', visualRoutes);
app.use('/api/recorder', recorderRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/traceability', traceabilityRoutes);
app.use('/api/bugs', bugRoutes);
app.use('/api/bug-patterns', bugPatternRoutes);
app.use('/api/code-analysis', codeAnalysisRoutes);
app.use('/api/test-evolution', testEvolutionRoutes);
app.use('/api/testpilot', testPilotRoutes);
app.use('/api/scriptsmith', scriptSmithSessionRoutes);
app.use('/api/flaky', flakyRoutes);
app.use('/api/duplicate', duplicateRoutes);
app.use('/api/jenkins', jenkinsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/quality-gates', qualityGateRoutes);
app.use('/api/approvals', approvalRoutes);
// Sprint 19: Advanced Features
app.use('/api/teams', teamRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Sprint 20: Postman Import & Templates
app.use('/api/postman', postmanRoutes);
app.use('/api/templates', templateRoutes);
// MaestroSmith: Maestro YAML flow generation
app.use('/api/maestro', maestroRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ error: err.message }, 'Error');

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Unknown error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
});

export default app;
