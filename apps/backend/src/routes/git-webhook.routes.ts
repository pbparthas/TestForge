/**
 * Git Webhook Routes
 * HMAC-verified webhook receiver — no auth middleware (verified by signature)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { syncService } from '../services/sync.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// =============================================================================
// HMAC VERIFICATION
// =============================================================================

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// =============================================================================
// WEBHOOK ENDPOINT
// =============================================================================

router.post('/', async (req: Request, res: Response) => {
  const secret = process.env.GIT_WEBHOOK_SECRET;
  if (!secret) {
    res.status(400).json({ error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook secret not configured' } });
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    res.status(401).json({ error: { code: 'MISSING_SIGNATURE', message: 'Missing X-Hub-Signature-256 header' } });
    return;
  }

  const rawBody = JSON.stringify(req.body);
  try {
    if (!verifySignature(rawBody, signature, secret)) {
      res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'HMAC signature verification failed' } });
      return;
    }
  } catch {
    res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'HMAC signature verification failed' } });
    return;
  }

  // Only process push events
  const event = req.headers['x-github-event'] as string;
  if (event !== 'push') {
    res.json({ message: 'Event ignored' });
    return;
  }

  // Trigger async sync — respond immediately
  const { projectId } = req.body;
  if (projectId) {
    syncService.syncFilesFromGit({ projectId }).catch((err) => {
      logger.error({ error: err, projectId }, 'Webhook sync failed');
    });
  }

  res.json({ message: 'Webhook processed' });
});

export default router;
