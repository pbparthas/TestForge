import { defineConfig } from 'vitest/config';

const isIntegrationDbRun = process.argv.some((arg) => arg.includes('tests/integration-db/'));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'tests',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        '**/prisma/seed.ts',
        '**/utils/logger.ts',
        '**/utils/prisma.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    // Integration DB suites share one postgres and execute TRUNCATE-based cleanup.
    // Force single-file execution for that target to prevent lock contention/deadlocks.
    fileParallelism: isIntegrationDbRun ? false : true,
    sequence: {
      concurrent: false,
    },
    pool: isIntegrationDbRun ? 'forks' : undefined,
    poolOptions: isIntegrationDbRun ? {
      forks: {
        singleFork: true,
      },
    } : undefined,
  },
});
