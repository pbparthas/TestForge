/**
 * Centralized Secrets Configuration
 * Validates all required secrets at startup, fails fast if missing.
 * Sprint 5: Replaces scattered process.env access with a single validated module.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface AppSecrets {
  jwt: { secret: string; expiresIn: string; refreshExpiresIn: string };
  database: { url: string };
  encryption: { key: string };
  anthropic?: { apiKey: string };
  git?: { webhookSecret: string };
  cors: { origin: string };
}

// =============================================================================
// LOADER
// =============================================================================

export function loadSecrets(): AppSecrets {
  const missing: string[] = [];

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) missing.push('JWT_SECRET');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) missing.push('DATABASE_URL');

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) missing.push('ENCRYPTION_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const secrets: AppSecrets = {
    jwt: {
      secret: jwtSecret!,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    database: {
      url: databaseUrl!,
    },
    encryption: {
      key: encryptionKey!,
    },
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    },
  };

  // Optional secrets
  if (process.env.ANTHROPIC_API_KEY) {
    secrets.anthropic = { apiKey: process.env.ANTHROPIC_API_KEY };
  }

  if (process.env.GIT_WEBHOOK_SECRET) {
    secrets.git = { webhookSecret: process.env.GIT_WEBHOOK_SECRET };
  }

  return secrets;
}

// Singleton — evaluated once at module load
export const secrets: AppSecrets = loadSecrets();
