/**
 * AI Agent Routes - Index
 * Assembles all per-agent route modules into a single router.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import testWeaverRoutes from './testweaver.routes.js';
import scriptSmithRoutes from './scriptsmith.routes.js';
import frameworkRoutes from './framework.routes.js';
import selfHealingRoutes from './selfhealing.routes.js';
import flowPilotRoutes from './flowpilot.routes.js';
import codeGuardianRoutes from './codeguardian.routes.js';
import usageRoutes from './usage.routes.js';

const router = Router();
router.use(authenticate);

router.use(testWeaverRoutes);
router.use(scriptSmithRoutes);
router.use(frameworkRoutes);
router.use(selfHealingRoutes);
router.use(flowPilotRoutes);
router.use(codeGuardianRoutes);
router.use(usageRoutes);

export default router;
