/**
 * Postman Import Service
 * Sprint 20: Convert parsed Postman collections to TestForge test cases/scripts
 *
 * Takes ParsedCollection from PostmanParserService and creates:
 * - Test cases (API test format)
 * - Playwright/Cypress scripts
 * - Or both
 */

import type {
  PostmanImport,
  PostmanImportType,
  PostmanImportStatus,
  TestType,
  Priority,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';
import {
  postmanParserService,
  type ParsedCollection,
  type ParsedRequest,
} from './postman-parser.service.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ImportOptions {
  importType: PostmanImportType;
  projectId: string;
  userId: string;
  defaultPriority?: Priority;
  defaultTestType?: TestType;
  createFolder?: boolean; // Create test suite from Postman folders
  variableMapping?: Record<string, string>; // Map Postman vars to actual values
  framework?: 'playwright' | 'cypress';
}

export interface ImportPreview {
  collection: {
    name: string;
    description?: string;
    requestCount: number;
    folders: string[];
    variables: Array<{ key: string; value: string }>;
  };
  requests: Array<{
    id: string;
    name: string;
    method: string;
    url: string;
    folder: string;
    hasAuth: boolean;
    hasBody: boolean;
    variablesUsed: string[];
  }>;
  warnings: string[];
  errors: Array<{ path: string; message: string }>;
}

export interface ImportResult {
  importId: string;
  status: PostmanImportStatus;
  totalRequests: number;
  importedCount: number;
  skippedCount: number;
  importedItems: Array<{
    type: 'test_case' | 'script';
    id: string;
    name: string;
    requestId: string;
  }>;
  errors: string[];
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Escape a string for safe inclusion in generated code
 */
function escapeForCode(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export class PostmanImportService {
  /**
   * Preview import without creating anything
   */
  async preview(jsonString: string): Promise<ImportPreview> {
    const parsed = postmanParserService.parse(jsonString);
    const warnings: string[] = [];

    // Check for potential issues
    if (parsed.variables.length > 0) {
      const undefinedVars = parsed.variables.filter(v => !v.value || v.value.startsWith('{{'));
      if (undefinedVars.length > 0) {
        warnings.push(
          `${undefinedVars.length} variable(s) have no default value: ${undefinedVars.map(v => v.key).join(', ')}`
        );
      }
    }

    // Check for auth
    const authRequests = parsed.requests.filter(r => r.auth);
    if (authRequests.length > 0) {
      warnings.push(
        `${authRequests.length} request(s) have authentication configured. Credentials will need to be updated after import.`
      );
    }

    // Check for pre-request scripts
    const scriptRequests = parsed.requests.filter(r => r.preRequestScript);
    if (scriptRequests.length > 0) {
      warnings.push(
        `${scriptRequests.length} request(s) have pre-request scripts. These will be included as comments.`
      );
    }

    return {
      collection: {
        name: parsed.name,
        description: parsed.description,
        requestCount: parsed.totalRequests,
        folders: parsed.folders,
        variables: parsed.variables,
      },
      requests: parsed.requests.map(r => ({
        id: r.id,
        name: r.name,
        method: r.method,
        url: r.url,
        folder: r.folder,
        hasAuth: !!r.auth,
        hasBody: !!r.body,
        variablesUsed: r.variables,
      })),
      warnings,
      errors: parsed.errors,
    };
  }

  /**
   * Import a Postman collection
   */
  async import(jsonString: string, options: ImportOptions): Promise<ImportResult> {
    const parsed = postmanParserService.parse(jsonString);

    // Create import record
    const importRecord = await prisma.postmanImport.create({
      data: {
        userId: options.userId,
        projectId: options.projectId,
        fileName: `${parsed.name}.json`,
        collectionName: parsed.name,
        collectionId: parsed.id,
        requestCount: parsed.totalRequests,
        importType: options.importType,
        status: 'processing',
        mappingConfig: options.variableMapping
          ? (options.variableMapping as object)
          : undefined,
      },
    });

    const importedItems: ImportResult['importedItems'] = [];
    const errors: string[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    try {
      for (const request of parsed.requests) {
        try {
          if (
            options.importType === 'test_cases' ||
            options.importType === 'both'
          ) {
            const testCase = await this.createTestCase(request, options, parsed);
            importedItems.push({
              type: 'test_case',
              id: testCase.id,
              name: testCase.title,
              requestId: request.id,
            });
          }

          if (
            options.importType === 'scripts' ||
            options.importType === 'both'
          ) {
            // Find or use the test case we just created
            let testCaseId: string;
            const existingItem = importedItems.find(
              i => i.requestId === request.id && i.type === 'test_case'
            );

            if (existingItem) {
              testCaseId = existingItem.id;
            } else {
              // Create a minimal test case to link the script
              const testCase = await this.createTestCase(request, options, parsed);
              testCaseId = testCase.id;
            }

            const script = await this.createScript(
              request,
              testCaseId,
              options,
              parsed
            );
            importedItems.push({
              type: 'script',
              id: script.id,
              name: script.name,
              requestId: request.id,
            });
          }

          importedCount++;
        } catch (e) {
          errors.push(`Failed to import "${request.name}": ${(e as Error).message}`);
          skippedCount++;
        }
      }

      // Update import record
      await prisma.postmanImport.update({
        where: { id: importRecord.id },
        data: {
          status: 'completed',
          importedCount,
          skippedCount,
          importedItems: importedItems as unknown as object,
          completedAt: new Date(),
          errorMessage: errors.length > 0 ? errors.join('; ') : null,
        },
      });

      return {
        importId: importRecord.id,
        status: 'completed',
        totalRequests: parsed.totalRequests,
        importedCount,
        skippedCount,
        importedItems,
        errors,
      };
    } catch (e) {
      // Update import record with failure
      await prisma.postmanImport.update({
        where: { id: importRecord.id },
        data: {
          status: 'failed',
          importedCount,
          skippedCount,
          importedItems: importedItems as unknown as object,
          errorMessage: (e as Error).message,
        },
      });

      throw e;
    }
  }

  /**
   * Create a test case from a Postman request
   */
  private async createTestCase(
    request: ParsedRequest,
    options: ImportOptions,
    collection: ParsedCollection
  ) {
    const steps = this.buildTestCaseSteps(request, options.variableMapping);

    return prisma.testCase.create({
      data: {
        projectId: options.projectId,
        title: `API: ${request.method} ${request.name}`,
        description: request.description ?? `Imported from Postman collection: ${collection.name}`,
        preconditions: this.buildPreconditions(request, collection),
        steps: steps as unknown as object,
        expectedResult: this.buildExpectedResult(request),
        priority: options.defaultPriority ?? 'medium',
        type: options.defaultTestType ?? 'api',
        isAutomated: false,
        createdById: options.userId,
      },
    });
  }

  /**
   * Create a script from a Postman request
   */
  private async createScript(
    request: ParsedRequest,
    testCaseId: string,
    options: ImportOptions,
    collection: ParsedCollection
  ) {
    const framework = options.framework ?? 'playwright';
    const code = this.generateScriptCode(request, framework, options.variableMapping, collection);

    return prisma.script.create({
      data: {
        testCaseId,
        projectId: options.projectId,
        name: `${request.name.replace(/[^a-zA-Z0-9]/g, '_')}.spec.ts`,
        code,
        language: 'typescript',
        framework,
        status: 'draft',
        generatedBy: 'postman_import',
        createdById: options.userId,
      },
    });
  }

  /**
   * Build test case steps from request
   */
  private buildTestCaseSteps(
    request: ParsedRequest,
    variableMapping?: Record<string, string>
  ): Array<{ order: number; action: string; expected: string }> {
    const steps: Array<{ order: number; action: string; expected: string }> = [];
    let order = 1;

    // Step 1: Set up authentication if needed
    if (request.auth) {
      steps.push({
        order: order++,
        action: `Set up ${request.auth.type} authentication`,
        expected: 'Authentication is configured',
      });
    }

    // Step 2: Prepare request
    const url = this.replaceVariables(request.url, variableMapping);
    steps.push({
      order: order++,
      action: `Prepare ${request.method} request to ${url}`,
      expected: 'Request is ready to send',
    });

    // Step 3: Add headers if present
    if (request.headers.length > 0) {
      steps.push({
        order: order++,
        action: `Add headers: ${request.headers.map(h => h.key).join(', ')}`,
        expected: 'Headers are set',
      });
    }

    // Step 4: Add body if present
    if (request.body) {
      steps.push({
        order: order++,
        action: `Set request body (${request.body.type})`,
        expected: 'Request body is set',
      });
    }

    // Step 5: Send request
    steps.push({
      order: order++,
      action: 'Send the request',
      expected: 'Response is received',
    });

    // Step 6: Verify response
    if (request.expectedResponses.length > 0) {
      const firstResponse = request.expectedResponses[0]!;
      steps.push({
        order: order++,
        action: `Verify response status is ${firstResponse.status}`,
        expected: `Response status code is ${firstResponse.status}`,
      });
    } else {
      steps.push({
        order: order++,
        action: 'Verify response status is 2xx',
        expected: 'Response indicates success',
      });
    }

    return steps;
  }

  /**
   * Build preconditions string
   */
  private buildPreconditions(
    request: ParsedRequest,
    collection: ParsedCollection
  ): string {
    const conditions: string[] = [];

    // Auth requirement
    if (request.auth) {
      conditions.push(`${request.auth.type} authentication credentials are available`);
    }

    // Variables
    if (request.variables.length > 0) {
      conditions.push(
        `Environment variables are set: ${request.variables.join(', ')}`
      );
    }

    // Pre-request script
    if (request.preRequestScript) {
      conditions.push('Pre-request script has been executed (see notes)');
    }

    // Collection-level requirements
    if (collection.auth && !request.auth) {
      conditions.push(
        `Collection-level ${collection.auth.type} authentication is configured`
      );
    }

    return conditions.length > 0
      ? conditions.join('\n')
      : 'API endpoint is accessible';
  }

  /**
   * Build expected result string
   */
  private buildExpectedResult(request: ParsedRequest): string {
    if (request.expectedResponses.length > 0) {
      const response = request.expectedResponses[0]!;
      return `Response status: ${response.status} (${response.name})`;
    }

    // Default expected results based on method
    switch (request.method.toUpperCase()) {
      case 'GET':
        return 'Returns requested data with status 200';
      case 'POST':
        return 'Creates resource and returns status 201';
      case 'PUT':
      case 'PATCH':
        return 'Updates resource and returns status 200';
      case 'DELETE':
        return 'Deletes resource and returns status 200 or 204';
      default:
        return 'Request completes successfully';
    }
  }

  /**
   * Generate Playwright or Cypress script code
   */
  private generateScriptCode(
    request: ParsedRequest,
    framework: 'playwright' | 'cypress',
    variableMapping?: Record<string, string>,
    collection?: ParsedCollection
  ): string {
    const url = this.replaceVariables(request.url, variableMapping);

    if (framework === 'playwright') {
      return this.generatePlaywrightCode(request, url, collection);
    } else {
      return this.generateCypressCode(request, url, collection);
    }
  }

  /**
   * Generate Playwright test code
   */
  private generatePlaywrightCode(
    request: ParsedRequest,
    url: string,
    collection?: ParsedCollection
  ): string {
    const lines: string[] = [
      `import { test, expect } from '@playwright/test';`,
      '',
    ];

    // Add description comment
    if (request.description) {
      lines.push(`/**`);
      lines.push(` * ${request.description}`);
      if (collection) {
        lines.push(` * Imported from Postman: ${collection.name}`);
      }
      lines.push(` */`);
    }

    // Pre-request script as comment
    if (request.preRequestScript) {
      lines.push('');
      lines.push('// Pre-request script from Postman:');
      request.preRequestScript.split('\n').forEach(line => {
        lines.push(`// ${line}`);
      });
    }

    lines.push('');
    lines.push(`test('${escapeForCode(request.name)}', async ({ request }) => {`);

    // Build request options
    const options: string[] = [];

    // Headers
    if (request.headers.length > 0) {
      const headersObj = request.headers.reduce(
        (acc, h) => ({ ...acc, [h.key]: h.value }),
        {}
      );
      options.push(`    headers: ${JSON.stringify(headersObj, null, 6).replace(/\n/g, '\n    ')},`);
    }

    // Body
    if (request.body) {
      if (request.body.type === 'json' || request.body.type === 'raw') {
        options.push(`    data: ${typeof request.body.content === 'string' ? request.body.content : JSON.stringify(request.body.content, null, 6).replace(/\n/g, '\n    ')},`);
      } else if (typeof request.body.content === 'object') {
        options.push(`    form: ${JSON.stringify(request.body.content, null, 6).replace(/\n/g, '\n    ')},`);
      }
    }

    // Make request
    const method = request.method.toLowerCase();
    const escapedUrl = escapeForCode(url);
    if (options.length > 0) {
      lines.push(`  const response = await request.${method}('${escapedUrl}', {`);
      options.forEach(opt => lines.push(opt));
      lines.push('  });');
    } else {
      lines.push(`  const response = await request.${method}('${escapedUrl}');`);
    }

    lines.push('');

    // Assertions
    if (request.expectedResponses.length > 0) {
      const expected = request.expectedResponses[0]!;
      lines.push(`  expect(response.status()).toBe(${expected.status});`);

      if (expected.body) {
        lines.push('');
        lines.push('  const body = await response.json();');
        lines.push('  // TODO: Add assertions for response body');
      }
    } else {
      lines.push('  expect(response.ok()).toBeTruthy();');
    }

    // Test script from Postman as comment
    if (request.testScript) {
      lines.push('');
      lines.push('  // Test script from Postman:');
      request.testScript.split('\n').forEach(line => {
        lines.push(`  // ${line}`);
      });
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate Cypress test code
   */
  private generateCypressCode(
    request: ParsedRequest,
    url: string,
    collection?: ParsedCollection
  ): string {
    const lines: string[] = [];

    // Add description comment
    if (request.description) {
      lines.push(`/**`);
      lines.push(` * ${request.description}`);
      if (collection) {
        lines.push(` * Imported from Postman: ${collection.name}`);
      }
      lines.push(` */`);
    }

    const escapedFolder = escapeForCode(request.folder || 'API');
    const escapedName = escapeForCode(request.name);
    const escapedUrl = escapeForCode(url);

    lines.push(`describe('${escapedFolder}', () => {`);
    lines.push(`  it('${escapedName}', () => {`);

    // Build request options
    const options: string[] = [`      method: '${request.method}',`, `      url: '${escapedUrl}',`];

    // Headers
    if (request.headers.length > 0) {
      const headersObj = request.headers.reduce(
        (acc, h) => ({ ...acc, [h.key]: h.value }),
        {}
      );
      options.push(`      headers: ${JSON.stringify(headersObj)},`);
    }

    // Body
    if (request.body && request.body.content) {
      options.push(`      body: ${typeof request.body.content === 'string' ? `'${request.body.content}'` : JSON.stringify(request.body.content)},`);
    }

    // Make request
    lines.push('    cy.request({');
    options.forEach(opt => lines.push(opt));
    lines.push('    }).then((response) => {');

    // Assertions
    if (request.expectedResponses.length > 0) {
      const expected = request.expectedResponses[0]!;
      lines.push(`      expect(response.status).to.eq(${expected.status});`);
    } else {
      lines.push('      expect(response.status).to.be.oneOf([200, 201, 204]);');
    }

    lines.push('    });');
    lines.push('  });');
    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Replace Postman variables with actual values
   */
  private replaceVariables(
    text: string,
    mapping?: Record<string, string>
  ): string {
    if (!mapping) return text;

    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      return mapping[varName] ?? match;
    });
  }

  /**
   * Get import history for a project
   */
  async getImportHistory(
    projectId: string,
    limit = 20
  ): Promise<PostmanImport[]> {
    return prisma.postmanImport.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get a single import by ID
   */
  async getImport(importId: string): Promise<PostmanImport> {
    const record = await prisma.postmanImport.findUnique({
      where: { id: importId },
    });

    if (!record) {
      throw new NotFoundError('PostmanImport', importId);
    }

    return record;
  }
}

export const postmanImportService = new PostmanImportService();
