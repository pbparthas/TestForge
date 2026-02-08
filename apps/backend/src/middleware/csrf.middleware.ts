/**
 * CSRF protection middleware using double-submit cookie pattern (SEC-006 remediation).
 * Sets a csrf_token cookie (readable by JS) on auth responses.
 * Validates X-CSRF-Token header matches cookie on state-changing requests.
 */

import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXCLUDED_PATHS = ['/api/git/webhook', '/health'];

/**
 * Generate a random CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set CSRF token cookie on the response.
 * Non-httpOnly so frontend JS can read it.
 */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JS needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes (matches access token)
  });
}

/**
 * CSRF validation middleware.
 * Skips safe methods (GET/HEAD/OPTIONS) and excluded paths (webhooks, health).
 * For all other requests, validates X-CSRF-Token header against csrf_token cookie.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip in test environment (matches rate-limit pattern; CSRF logic is unit-tested separately)
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  // Skip safe methods
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Skip excluded paths
  if (EXCLUDED_PATHS.some(p => req.path.startsWith(p))) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    res.status(403).json({
      error: {
        code: 'CSRF_ERROR',
        message: 'CSRF token missing',
      },
    });
    return;
  }

  // Timing-safe comparison
  if (cookieToken.length !== headerToken.length) {
    res.status(403).json({
      error: {
        code: 'CSRF_ERROR',
        message: 'CSRF token mismatch',
      },
    });
    return;
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(cookieToken, 'utf8'),
    Buffer.from(headerToken, 'utf8'),
  );

  if (!valid) {
    res.status(403).json({
      error: {
        code: 'CSRF_ERROR',
        message: 'CSRF token mismatch',
      },
    });
    return;
  }

  next();
}
