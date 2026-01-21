/**
 * Jenkins Service Tests
 * TDD for CI/CD integration with Jenkins
 */

const { mockPrisma, mockEncrypt, mockDecrypt, mockFetch } = vi.hoisted(() => ({
  mockPrisma: {
    jenkinsIntegration: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    jenkinsBuild: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
  mockEncrypt: vi.fn(),
  mockDecrypt: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/utils/encryption.js', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
  getEncryptionKey: vi.fn().mockReturnValue('a'.repeat(64)),
}));

// Mock global fetch
global.fetch = mockFetch;

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JenkinsService } from '../../../src/services/jenkins.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('JenkinsService', () => {
  let service: JenkinsService;

  const mockIntegration = {
    id: 'int-123',
    projectId: 'proj-123',
    integrationName: 'Main CI',
    serverUrl: 'https://jenkins.example.com',
    username: 'admin',
    apiTokenEncrypted: 'encrypted-token',
    jobPath: '/job/test-pipeline',
    defaultEnvironment: 'staging',
    defaultBrowser: 'chrome',
    buildParameters: { parallelism: 4 },
    isActive: true,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBuild = {
    id: 'build-123',
    integrationId: 'int-123',
    executionId: 'exec-123',
    jenkinsBuildNumber: 42,
    jenkinsBuildUrl: 'https://jenkins.example.com/job/test-pipeline/42/',
    status: 'pending',
    parameters: { ENVIRONMENT: 'staging' },
    startedAt: null,
    completedAt: null,
    durationMs: null,
    totalTests: null,
    passedTests: null,
    failedTests: null,
    consoleLogUrl: 'https://jenkins.example.com/job/test-pipeline/42/console',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JenkinsService();
    mockEncrypt.mockReturnValue('encrypted-value');
    mockDecrypt.mockReturnValue('decrypted-api-token');
  });

  // ============================================================================
  // Integration CRUD Tests
  // ============================================================================

  describe('createIntegration', () => {
    it('should create integration with encrypted API token', async () => {
      mockPrisma.jenkinsIntegration.create.mockResolvedValue(mockIntegration);

      const result = await service.createIntegration({
        projectId: 'proj-123',
        integrationName: 'Main CI',
        serverUrl: 'https://jenkins.example.com',
        username: 'admin',
        apiToken: 'plain-api-token',
        jobPath: '/job/test-pipeline',
        createdById: 'user-123',
      });

      expect(mockEncrypt).toHaveBeenCalledWith('plain-api-token', expect.any(String));
      expect(mockPrisma.jenkinsIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-123',
          integrationName: 'Main CI',
          serverUrl: 'https://jenkins.example.com',
          username: 'admin',
          apiTokenEncrypted: 'encrypted-value',
          jobPath: '/job/test-pipeline',
          createdById: 'user-123',
        }),
      });
      expect(result).toEqual(mockIntegration);
    });

    it('should normalize server URL by removing trailing slash', async () => {
      mockPrisma.jenkinsIntegration.create.mockResolvedValue(mockIntegration);

      await service.createIntegration({
        projectId: 'proj-123',
        integrationName: 'CI',
        serverUrl: 'https://jenkins.example.com/',
        username: 'admin',
        apiToken: 'token',
        jobPath: '/job/test',
        createdById: 'user-123',
      });

      expect(mockPrisma.jenkinsIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serverUrl: 'https://jenkins.example.com',
        }),
      });
    });

    it('should set optional fields when provided', async () => {
      mockPrisma.jenkinsIntegration.create.mockResolvedValue(mockIntegration);

      await service.createIntegration({
        projectId: 'proj-123',
        integrationName: 'CI',
        serverUrl: 'https://jenkins.example.com',
        username: 'admin',
        apiToken: 'token',
        jobPath: '/job/test',
        defaultEnvironment: 'staging',
        defaultBrowser: 'chrome',
        buildParameters: { key: 'value' },
        createdById: 'user-123',
      });

      expect(mockPrisma.jenkinsIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          defaultEnvironment: 'staging',
          defaultBrowser: 'chrome',
          buildParameters: { key: 'value' },
        }),
      });
    });
  });

  describe('getIntegration', () => {
    it('should return integration by ID', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(mockIntegration);

      const result = await service.getIntegration('int-123');

      expect(mockPrisma.jenkinsIntegration.findUnique).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        include: { builds: { take: 5, orderBy: { createdAt: 'desc' } } },
      });
      expect(result).toEqual(mockIntegration);
    });

    it('should throw NotFoundError when integration not found', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(null);

      await expect(service.getIntegration('not-found')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getProjectIntegrations', () => {
    it('should return all integrations for a project', async () => {
      mockPrisma.jenkinsIntegration.findMany.mockResolvedValue([mockIntegration]);

      const result = await service.getProjectIntegrations('proj-123');

      expect(mockPrisma.jenkinsIntegration.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-123' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by active status when specified', async () => {
      mockPrisma.jenkinsIntegration.findMany.mockResolvedValue([mockIntegration]);

      await service.getProjectIntegrations('proj-123', { isActive: true });

      expect(mockPrisma.jenkinsIntegration.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-123', isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateIntegration', () => {
    it('should update integration without API token', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockPrisma.jenkinsIntegration.update.mockResolvedValue({
        ...mockIntegration,
        integrationName: 'Updated CI',
      });

      const result = await service.updateIntegration('int-123', {
        integrationName: 'Updated CI',
      });

      expect(mockPrisma.jenkinsIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        data: { integrationName: 'Updated CI' },
      });
      expect(result.integrationName).toBe('Updated CI');
    });

    it('should encrypt new API token when provided', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockPrisma.jenkinsIntegration.update.mockResolvedValue(mockIntegration);

      await service.updateIntegration('int-123', {
        apiToken: 'new-token',
      });

      expect(mockEncrypt).toHaveBeenCalledWith('new-token', expect.any(String));
      expect(mockPrisma.jenkinsIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int-123' },
        data: { apiTokenEncrypted: 'encrypted-value' },
      });
    });

    it('should throw NotFoundError when integration not found', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(null);

      await expect(service.updateIntegration('not-found', {})).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockPrisma.jenkinsIntegration.delete.mockResolvedValue(mockIntegration);

      await service.deleteIntegration('int-123');

      expect(mockPrisma.jenkinsIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'int-123' },
      });
    });

    it('should throw NotFoundError when integration not found', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(null);

      await expect(service.deleteIntegration('not-found')).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // Connection Test
  // ============================================================================

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ _class: 'hudson.model.Hudson' }),
      });

      const result = await service.testConnection({
        serverUrl: 'https://jenkins.example.com',
        username: 'admin',
        apiToken: 'token',
      });

      expect(result.success).toBe(true);
      expect(result.version).toBeDefined();
    });

    it('should return failure for invalid credentials', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await service.testConnection({
        serverUrl: 'https://jenkins.example.com',
        username: 'admin',
        apiToken: 'wrong-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should return failure for network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.testConnection({
        serverUrl: 'https://jenkins.example.com',
        username: 'admin',
        apiToken: 'token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  // ============================================================================
  // Build Trigger Tests
  // ============================================================================

  describe('triggerBuild', () => {
    it('should trigger Jenkins build and return build record', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'https://jenkins.example.com/queue/item/123/',
        },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          executable: { number: 42, url: 'https://jenkins.example.com/job/test-pipeline/42/' },
        }),
      });
      mockPrisma.jenkinsBuild.create.mockResolvedValue(mockBuild);

      const result = await service.triggerBuild('int-123', {
        environment: 'staging',
        browser: 'chrome',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/job/test-pipeline/buildWithParameters'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
      expect(mockPrisma.jenkinsBuild.create).toHaveBeenCalled();
      expect(result).toEqual(mockBuild);
    });

    it('should include execution ID in build when provided', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'https://jenkins.example.com/queue/item/123/' },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          executable: { number: 42, url: 'https://jenkins.example.com/job/test-pipeline/42/' },
        }),
      });
      mockPrisma.jenkinsBuild.create.mockResolvedValue(mockBuild);

      await service.triggerBuild('int-123', {}, 'exec-456');

      expect(mockPrisma.jenkinsBuild.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          executionId: 'exec-456',
        }),
      });
    });

    it('should throw NotFoundError when integration not found', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue(null);

      await expect(service.triggerBuild('not-found', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when integration is inactive', async () => {
      mockPrisma.jenkinsIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        isActive: false,
      });

      await expect(service.triggerBuild('int-123', {})).rejects.toThrow(ValidationError);
    });
  });

  // ============================================================================
  // Build Status Tests
  // ============================================================================

  describe('getBuild', () => {
    it('should return build by ID', async () => {
      mockPrisma.jenkinsBuild.findUnique.mockResolvedValue(mockBuild);

      const result = await service.getBuild('build-123');

      expect(result).toEqual(mockBuild);
    });

    it('should throw NotFoundError when build not found', async () => {
      mockPrisma.jenkinsBuild.findUnique.mockResolvedValue(null);

      await expect(service.getBuild('not-found')).rejects.toThrow(NotFoundError);
    });
  });

  describe('pollBuildStatus', () => {
    it('should update build status from Jenkins', async () => {
      mockPrisma.jenkinsBuild.findUnique.mockResolvedValue({
        ...mockBuild,
        integration: mockIntegration,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          building: false,
          result: 'SUCCESS',
          timestamp: Date.now(),
          duration: 12000,
        }),
      });
      mockPrisma.jenkinsBuild.update.mockResolvedValue({
        ...mockBuild,
        status: 'success',
      });

      const result = await service.pollBuildStatus('build-123');

      expect(result.status).toBe('success');
    });

    it('should update status to building when in progress', async () => {
      mockPrisma.jenkinsBuild.findUnique.mockResolvedValue({
        ...mockBuild,
        integration: mockIntegration,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          building: true,
          timestamp: Date.now(),
        }),
      });
      mockPrisma.jenkinsBuild.update.mockResolvedValue({
        ...mockBuild,
        status: 'building',
      });

      const result = await service.pollBuildStatus('build-123');

      expect(result.status).toBe('building');
    });

    it('should parse test results from Jenkins', async () => {
      mockPrisma.jenkinsBuild.findUnique.mockResolvedValue({
        ...mockBuild,
        integration: mockIntegration,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          building: false,
          result: 'SUCCESS',
          timestamp: Date.now(),
          duration: 12000,
          actions: [
            {
              _class: 'hudson.tasks.junit.TestResultAction',
              totalCount: 100,
              failCount: 5,
              skipCount: 2,
            },
          ],
        }),
      });
      mockPrisma.jenkinsBuild.update.mockResolvedValue({
        ...mockBuild,
        status: 'success',
        totalTests: 100,
        passedTests: 93,
        failedTests: 5,
      });

      const result = await service.pollBuildStatus('build-123');

      expect(mockPrisma.jenkinsBuild.update).toHaveBeenCalledWith({
        where: { id: 'build-123' },
        data: expect.objectContaining({
          totalTests: 100,
          passedTests: 93,
          failedTests: 5,
        }),
      });
    });
  });

  describe('getIntegrationBuilds', () => {
    it('should return builds for an integration', async () => {
      mockPrisma.jenkinsBuild.findMany.mockResolvedValue([mockBuild]);
      mockPrisma.jenkinsBuild.count.mockResolvedValue(1);

      const result = await service.getIntegrationBuilds('int-123', { limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status when specified', async () => {
      mockPrisma.jenkinsBuild.findMany.mockResolvedValue([mockBuild]);
      mockPrisma.jenkinsBuild.count.mockResolvedValue(1);

      await service.getIntegrationBuilds('int-123', { status: 'success' });

      expect(mockPrisma.jenkinsBuild.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { integrationId: 'int-123', status: 'success' },
        })
      );
    });
  });

  // ============================================================================
  // Console Log Tests
  // ============================================================================

  describe('getConsoleLog', () => {
    it('should fetch console log from Jenkins', async () => {
      mockPrisma.jenkinsBuild.findUnique.mockResolvedValue({
        ...mockBuild,
        integration: mockIntegration,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Console output...'),
      });

      const result = await service.getConsoleLog('build-123');

      expect(result).toBe('Console output...');
    });

    it('should throw NotFoundError when build not found', async () => {
      mockPrisma.jenkinsBuild.findUnique.mockResolvedValue(null);

      await expect(service.getConsoleLog('not-found')).rejects.toThrow(NotFoundError);
    });
  });
});
