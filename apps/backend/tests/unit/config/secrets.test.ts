/**
 * Secrets Config Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('loadSecrets', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set required env vars
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    // Clear optional
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GIT_WEBHOOK_SECRET;
    delete process.env.CORS_ORIGIN;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Dynamic import to re-evaluate loadSecrets each time
  async function importLoadSecrets() {
    const mod = await import('../../../src/config/secrets.js');
    return mod.loadSecrets;
  }

  it('should load all required secrets successfully', async () => {
    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.jwt.secret).toBe('test-jwt-secret');
    expect(secrets.database.url).toBe('postgresql://localhost:5432/test');
    expect(secrets.encryption.key).toBe('a'.repeat(64));
  });

  it('should use default values for optional JWT config', async () => {
    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.jwt.expiresIn).toBe('15m');
    expect(secrets.jwt.refreshExpiresIn).toBe('7d');
  });

  it('should use custom JWT expiry values when provided', async () => {
    process.env.JWT_EXPIRES_IN = '30m';
    process.env.JWT_REFRESH_EXPIRES_IN = '14d';

    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.jwt.expiresIn).toBe('30m');
    expect(secrets.jwt.refreshExpiresIn).toBe('14d');
  });

  it('should use default CORS origin when not provided', async () => {
    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.cors.origin).toBe('http://localhost:5173');
  });

  it('should use custom CORS origin when provided', async () => {
    process.env.CORS_ORIGIN = 'https://app.testforge.io';

    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.cors.origin).toBe('https://app.testforge.io');
  });

  it('should include anthropic config when API key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.anthropic).toEqual({ apiKey: 'sk-ant-test' });
  });

  it('should not include anthropic config when API key is not set', async () => {
    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.anthropic).toBeUndefined();
  });

  it('should include git config when webhook secret is set', async () => {
    process.env.GIT_WEBHOOK_SECRET = 'webhook-secret-123';

    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.git).toEqual({ webhookSecret: 'webhook-secret-123' });
  });

  it('should not include git config when webhook secret is not set', async () => {
    const loadSecrets = await importLoadSecrets();
    const secrets = loadSecrets();

    expect(secrets.git).toBeUndefined();
  });

  it('should throw when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;

    const loadSecrets = await importLoadSecrets();

    expect(() => loadSecrets()).toThrow('Missing required environment variables: JWT_SECRET');
  });

  it('should throw when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;

    const loadSecrets = await importLoadSecrets();

    expect(() => loadSecrets()).toThrow('Missing required environment variables: DATABASE_URL');
  });

  it('should throw when ENCRYPTION_KEY is missing', async () => {
    delete process.env.ENCRYPTION_KEY;

    const loadSecrets = await importLoadSecrets();

    expect(() => loadSecrets()).toThrow('Missing required environment variables: ENCRYPTION_KEY');
  });

  it('should list all missing required variables in error', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.ENCRYPTION_KEY;

    const loadSecrets = await importLoadSecrets();

    expect(() => loadSecrets()).toThrow(
      'Missing required environment variables: JWT_SECRET, DATABASE_URL, ENCRYPTION_KEY'
    );
  });
});
