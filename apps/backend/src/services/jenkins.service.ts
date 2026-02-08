/**
 * Jenkins Service
 * CI/CD integration for automated test execution
 */

import { prisma } from '../utils/prisma.js';
import { encrypt, decrypt, getEncryptionKey } from '../utils/encryption.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { validateExternalUrl } from '../utils/url-security.js';
import type { JenkinsIntegration, JenkinsBuild, JenkinsBuildStatus } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface CreateIntegrationInput {
  projectId: string;
  integrationName: string;
  serverUrl: string;
  username: string;
  apiToken: string;
  jobPath: string;
  defaultEnvironment?: string;
  defaultBrowser?: string;
  buildParameters?: Record<string, unknown>;
  createdById: string;
}

export interface UpdateIntegrationInput {
  integrationName?: string;
  serverUrl?: string;
  username?: string;
  apiToken?: string;
  jobPath?: string;
  defaultEnvironment?: string;
  defaultBrowser?: string;
  buildParameters?: Record<string, unknown>;
  isActive?: boolean;
}

export interface TestConnectionInput {
  serverUrl: string;
  username: string;
  apiToken: string;
}

export interface TestConnectionResult {
  success: boolean;
  version?: string;
  error?: string;
}

export interface TriggerBuildParams {
  environment?: string;
  browser?: string;
  testSuiteId?: string;
  testCaseIds?: string[];
  customParams?: Record<string, string>;
}

export interface BuildListFilters {
  status?: JenkinsBuildStatus;
  limit?: number;
  offset?: number;
}

export interface IntegrationFilters {
  isActive?: boolean;
}

// =============================================================================
// Service
// =============================================================================

export class JenkinsService {
  private _encryptionKey: string | null = null;

  private get encryptionKey(): string {
    if (!this._encryptionKey) {
      this._encryptionKey = getEncryptionKey();
    }
    return this._encryptionKey;
  }

  // ===========================================================================
  // Integration CRUD
  // ===========================================================================

  async createIntegration(input: CreateIntegrationInput): Promise<JenkinsIntegration> {
    // Normalize server URL
    const serverUrl = input.serverUrl.replace(/\/+$/, '');

    // Encrypt API token
    const apiTokenEncrypted = encrypt(input.apiToken, this.encryptionKey);

    return prisma.jenkinsIntegration.create({
      data: {
        projectId: input.projectId,
        integrationName: input.integrationName,
        serverUrl,
        username: input.username,
        apiTokenEncrypted,
        jobPath: input.jobPath,
        defaultEnvironment: input.defaultEnvironment,
        defaultBrowser: input.defaultBrowser,
        buildParameters: input.buildParameters,
        createdById: input.createdById,
      },
    });
  }

  async getIntegration(id: string): Promise<JenkinsIntegration & { builds?: JenkinsBuild[] }> {
    const integration = await prisma.jenkinsIntegration.findUnique({
      where: { id },
      include: { builds: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    if (!integration) {
      throw new NotFoundError('JenkinsIntegration', id);
    }

    return integration;
  }

  async getProjectIntegrations(
    projectId: string,
    filters?: IntegrationFilters
  ): Promise<JenkinsIntegration[]> {
    return prisma.jenkinsIntegration.findMany({
      where: {
        projectId,
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateIntegration(
    id: string,
    input: UpdateIntegrationInput
  ): Promise<JenkinsIntegration> {
    // Verify integration exists
    const existing = await prisma.jenkinsIntegration.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('JenkinsIntegration', id);
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (input.integrationName !== undefined) {
      updateData.integrationName = input.integrationName;
    }
    if (input.serverUrl !== undefined) {
      updateData.serverUrl = input.serverUrl.replace(/\/+$/, '');
    }
    if (input.username !== undefined) {
      updateData.username = input.username;
    }
    if (input.apiToken !== undefined) {
      updateData.apiTokenEncrypted = encrypt(input.apiToken, this.encryptionKey);
    }
    if (input.jobPath !== undefined) {
      updateData.jobPath = input.jobPath;
    }
    if (input.defaultEnvironment !== undefined) {
      updateData.defaultEnvironment = input.defaultEnvironment;
    }
    if (input.defaultBrowser !== undefined) {
      updateData.defaultBrowser = input.defaultBrowser;
    }
    if (input.buildParameters !== undefined) {
      updateData.buildParameters = input.buildParameters;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    return prisma.jenkinsIntegration.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteIntegration(id: string): Promise<void> {
    const existing = await prisma.jenkinsIntegration.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('JenkinsIntegration', id);
    }

    await prisma.jenkinsIntegration.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // Connection Test
  // ===========================================================================

  async testConnection(input: TestConnectionInput): Promise<TestConnectionResult> {
    try {
      const serverUrl = input.serverUrl.replace(/\/+$/, '');
      validateExternalUrl(serverUrl);
      const authHeader = this.buildAuthHeader(input.username, input.apiToken);

      const response = await fetch(`${serverUrl}/api/json`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        version: data.description || data._class || 'Jenkins',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===========================================================================
  // Build Management
  // ===========================================================================

  async triggerBuild(
    integrationId: string,
    params: TriggerBuildParams,
    executionId?: string
  ): Promise<JenkinsBuild> {
    // Get integration
    const integration = await prisma.jenkinsIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundError('JenkinsIntegration', integrationId);
    }

    if (!integration.isActive) {
      throw new ValidationError('Integration is inactive');
    }

    // Decrypt API token
    const apiToken = decrypt(integration.apiTokenEncrypted, this.encryptionKey);
    const authHeader = this.buildAuthHeader(integration.username, apiToken);

    // Build parameters
    const buildParams = new URLSearchParams();
    if (params.environment || integration.defaultEnvironment) {
      buildParams.append('ENVIRONMENT', params.environment || integration.defaultEnvironment || '');
    }
    if (params.browser || integration.defaultBrowser) {
      buildParams.append('BROWSER', params.browser || integration.defaultBrowser || '');
    }
    if (params.testSuiteId) {
      buildParams.append('TEST_SUITE_ID', params.testSuiteId);
    }
    if (params.testCaseIds?.length) {
      buildParams.append('TEST_CASE_IDS', params.testCaseIds.join(','));
    }
    if (params.customParams) {
      for (const [key, value] of Object.entries(params.customParams)) {
        buildParams.append(key, value);
      }
    }

    // Trigger build
    const buildUrl = `${integration.serverUrl}${integration.jobPath}/buildWithParameters`;
    validateExternalUrl(integration.serverUrl);
    const response = await fetch(buildUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildParams.toString(),
    });

    if (!response.ok) {
      throw new ValidationError(`Failed to trigger build: ${response.status} ${response.statusText}`);
    }

    // Get queue location
    const queueLocation = response.headers.get('Location');
    if (!queueLocation) {
      throw new ValidationError('No queue location returned from Jenkins');
    }

    // Poll queue to get build number
    const { buildNumber, buildUrl: jenkinsBuildUrl } = await this.waitForBuildStart(
      queueLocation,
      authHeader
    );

    // Create build record
    return prisma.jenkinsBuild.create({
      data: {
        integrationId,
        executionId,
        jenkinsBuildNumber: buildNumber,
        jenkinsBuildUrl,
        status: 'pending',
        parameters: Object.fromEntries(buildParams.entries()),
        consoleLogUrl: `${jenkinsBuildUrl}console`,
      },
    });
  }

  async getBuild(id: string): Promise<JenkinsBuild> {
    const build = await prisma.jenkinsBuild.findUnique({
      where: { id },
    });

    if (!build) {
      throw new NotFoundError('JenkinsBuild', id);
    }

    return build;
  }

  async pollBuildStatus(buildId: string): Promise<JenkinsBuild> {
    const build = await prisma.jenkinsBuild.findUnique({
      where: { id: buildId },
      include: { integration: true },
    });

    if (!build) {
      throw new NotFoundError('JenkinsBuild', buildId);
    }

    const integration = build.integration;
    const apiToken = decrypt(integration.apiTokenEncrypted, this.encryptionKey);
    const authHeader = this.buildAuthHeader(integration.username, apiToken);

    // Fetch build status from Jenkins
    validateExternalUrl(build.jenkinsBuildUrl);
    const response = await fetch(`${build.jenkinsBuildUrl}api/json`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new ValidationError(`Failed to get build status: ${response.status}`);
    }

    const data = await response.json();

    // Determine status
    let status: JenkinsBuildStatus = 'pending';
    if (data.building) {
      status = 'building';
    } else if (data.result === 'SUCCESS') {
      status = 'success';
    } else if (data.result === 'FAILURE') {
      status = 'failure';
    } else if (data.result === 'ABORTED') {
      status = 'aborted';
    }

    // Parse test results if available
    let totalTests: number | null = null;
    let passedTests: number | null = null;
    let failedTests: number | null = null;

    if (data.actions) {
      const testAction = data.actions.find(
        (a: Record<string, unknown>) => a._class === 'hudson.tasks.junit.TestResultAction'
      );
      if (testAction) {
        totalTests = testAction.totalCount || 0;
        failedTests = testAction.failCount || 0;
        const skipCount = testAction.skipCount || 0;
        passedTests = totalTests - failedTests - skipCount;
      }
    }

    // Update build record
    return prisma.jenkinsBuild.update({
      where: { id: buildId },
      data: {
        status,
        startedAt: data.timestamp ? new Date(data.timestamp) : undefined,
        completedAt: !data.building && data.timestamp ? new Date(data.timestamp + (data.duration || 0)) : undefined,
        durationMs: data.duration || null,
        totalTests,
        passedTests,
        failedTests,
      },
    });
  }

  async getIntegrationBuilds(
    integrationId: string,
    filters?: BuildListFilters
  ): Promise<{ data: JenkinsBuild[]; total: number }> {
    const where = {
      integrationId,
      ...(filters?.status && { status: filters.status }),
    };

    const [data, total] = await Promise.all([
      prisma.jenkinsBuild.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
      }),
      prisma.jenkinsBuild.count({ where }),
    ]);

    return { data, total };
  }

  // ===========================================================================
  // Console Log
  // ===========================================================================

  async getConsoleLog(buildId: string): Promise<string> {
    const build = await prisma.jenkinsBuild.findUnique({
      where: { id: buildId },
      include: { integration: true },
    });

    if (!build) {
      throw new NotFoundError('JenkinsBuild', buildId);
    }

    const integration = build.integration;
    const apiToken = decrypt(integration.apiTokenEncrypted, this.encryptionKey);
    const authHeader = this.buildAuthHeader(integration.username, apiToken);

    validateExternalUrl(build.jenkinsBuildUrl);
    const response = await fetch(`${build.jenkinsBuildUrl}consoleText`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      throw new ValidationError(`Failed to get console log: ${response.status}`);
    }

    return response.text();
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private buildAuthHeader(username: string, apiToken: string): string {
    const credentials = Buffer.from(`${username}:${apiToken}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async waitForBuildStart(
    queueLocation: string,
    authHeader: string,
    maxWaitMs = 30000
  ): Promise<{ buildNumber: number; buildUrl: string }> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(`${queueLocation}api/json`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.executable) {
          return {
            buildNumber: data.executable.number,
            buildUrl: data.executable.url,
          };
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new ValidationError('Timeout waiting for build to start');
  }
}

export const jenkinsService = new JenkinsService();
