/**
 * TestForge Backend Server
 * Entry point for the application
 */

import app from './app.js';
import { logger } from './utils/logger.js';
import { startLockCleanup } from './cron/lock-cleanup.js';

const port = process.env.PORT ?? 3000;

// Start server
app.listen(port, () => {
  logger.info({ port }, 'TestForge backend started');
  startLockCleanup();
});

export { app };
