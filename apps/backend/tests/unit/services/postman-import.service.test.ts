/**
 * Postman Import Service Unit Tests
 * Sprint 20: Tests for importing parsed Postman collections into TestForge
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

const { mockPrisma, mockPostmanParser } = vi.hoisted(() => ({
  mockPrisma: {
    postmanImport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    testCase: {
      create: vi.fn(),
    },
    script: {
      create: vi.fn(),
    },
  },
  mockPostmanParser: {
    parse: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/services/postman-parser.service.js', () => ({
  postmanParserService: mockPostmanParser,
}));

import { PostmanImportService } from '../../../src/services/postman-import.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A clean parsed collection with two requests (no warnings) */
function buildParsedCollection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coll-1',
    name: 'API Tests',
    description: 'Test collection',
    totalRequests: 2,
    folders: ['Auth', 'Users'],
    variables: [{ key: 'baseUrl', value: 'https://api.example.com' }],
    auth: null,
    errors: [],
    requests: [
      {
        id: 'req-1',
        name: 'Login',
        method: 'POST',
        url: '{{baseUrl}}/auth/login',
        description: 'Login endpoint',
        folder: 'Auth',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: { email: 'test@example.com', password: 'pass' },
        },
        auth: {
          type: 'bearer',
          credentials: { token: '{{token}}' },
        },
        preRequestScript: null,
        testScript: null,
        variables: ['baseUrl'],
        expectedResponses: [{ name: 'Success', status: 200, body: null }],
      },
      {
        id: 'req-2',
        name: 'Get Users',
        method: 'GET',
        url: '{{baseUrl}}/users',
        description: null,
        folder: 'Users',
        headers: [],
        body: null,
        auth: null,
        preRequestScript: 'pm.environment.set("token", "abc")',
        testScript: null,
        variables: ['baseUrl'],
        expectedResponses: [],
      },
    ],
    ...overrides,
  };
}

const baseImportOptions = {
  importType: 'test_cases' as const,
  projectId: 'proj-1',
  userId: 'user-1',
  defaultPriority: 'medium' as const,
  defaultTestType: 'api' as const,
  framework: 'playwright' as const,
};

function mockCreatedTestCase(index: number) {
  return {
    id: `tc-created-${index}`,
    title: `API: POST Login`,
    projectId: 'proj-1',
    description: 'Login endpoint',
    priority: 'medium',
    type: 'api',
    isAutomated: false,
    createdById: 'user-1',
  };
}

function mockCreatedScript(index: number) {
  return {
    id: `script-created-${index}`,
    name: 'Login.spec.ts',
    testCaseId: `tc-created-${index}`,
    projectId: 'proj-1',
    language: 'typescript',
    framework: 'playwright',
    status: 'draft',
    generatedBy: 'postman_import',
    createdById: 'user-1',
  };
}

const mockImportRecord = {
  id: 'import-1',
  userId: 'user-1',
  projectId: 'proj-1',
  fileName: 'API Tests.json',
  collectionName: 'API Tests',
  collectionId: 'coll-1',
  requestCount: 2,
  importType: 'test_cases',
  status: 'processing',
  mappingConfig: null,
  importedCount: 0,
  skippedCount: 0,
  importedItems: null,
  errorMessage: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostmanImportService', () => {
  let service: PostmanImportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PostmanImportService();
  });

  // ==========================================================================
  // preview()
  // ==========================================================================

  describe('preview', () => {
    it('should return collection info, request list, and no warnings for a clean collection', async () => {
      const parsed = buildParsedCollection({
        // Remove auth and pre-request script to make it "clean"
        requests: [
          {
            id: 'req-1',
            name: 'Get Health',
            method: 'GET',
            url: 'https://api.example.com/health',
            description: 'Health check',
            folder: 'Root',
            headers: [],
            body: null,
            auth: null,
            preRequestScript: null,
            testScript: null,
            variables: [],
            expectedResponses: [{ name: 'OK', status: 200, body: null }],
          },
        ],
        variables: [{ key: 'baseUrl', value: 'https://api.example.com' }],
      });
      mockPostmanParser.parse.mockReturnValue(parsed);

      const result = await service.preview('{}');

      expect(result.collection.name).toBe('API Tests');
      expect(result.collection.requestCount).toBe(2);
      expect(result.collection.folders).toEqual(['Auth', 'Users']);
      expect(result.collection.variables).toEqual([
        { key: 'baseUrl', value: 'https://api.example.com' },
      ]);
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toMatchObject({
        id: 'req-1',
        name: 'Get Health',
        method: 'GET',
        hasAuth: false,
        hasBody: false,
      });
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should add a warning for undefined variables (no default value)', async () => {
      const parsed = buildParsedCollection({
        variables: [
          { key: 'baseUrl', value: 'https://api.example.com' },
          { key: 'token', value: '' },
          { key: 'secret', value: '{{fromEnv}}' },
        ],
      });
      mockPostmanParser.parse.mockReturnValue(parsed);

      const result = await service.preview('{}');

      const undefinedWarning = result.warnings.find(w => w.includes('no default value'));
      expect(undefinedWarning).toBeDefined();
      expect(undefinedWarning).toContain('token');
      expect(undefinedWarning).toContain('secret');
      expect(undefinedWarning).toContain('2 variable(s)');
    });

    it('should add a warning for requests with authentication configured', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      const result = await service.preview('{}');

      const authWarning = result.warnings.find(w => w.includes('authentication'));
      expect(authWarning).toBeDefined();
      expect(authWarning).toContain('1 request(s)');
      expect(authWarning).toContain('Credentials will need to be updated');
    });

    it('should add a warning for requests with pre-request scripts', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      const result = await service.preview('{}');

      const scriptWarning = result.warnings.find(w => w.includes('pre-request scripts'));
      expect(scriptWarning).toBeDefined();
      expect(scriptWarning).toContain('1 request(s)');
      expect(scriptWarning).toContain('included as comments');
    });

    it('should include errors propagated from the parser', async () => {
      const parsed = buildParsedCollection({
        errors: [
          { path: 'Auth/Broken', message: 'Missing request URL' },
        ],
      });
      mockPostmanParser.parse.mockReturnValue(parsed);

      const result = await service.preview('{}');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        path: 'Auth/Broken',
        message: 'Missing request URL',
      });
    });
  });

  // ==========================================================================
  // import()
  // ==========================================================================

  describe('import', () => {
    beforeEach(() => {
      mockPrisma.postmanImport.create.mockResolvedValue({ ...mockImportRecord });
      mockPrisma.postmanImport.update.mockResolvedValue({ ...mockImportRecord, status: 'completed' });
    });

    it('should create import record and test cases only when importType is test_cases', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      let tcIndex = 0;
      mockPrisma.testCase.create.mockImplementation(() => {
        tcIndex++;
        return Promise.resolve({
          id: `tc-created-${tcIndex}`,
          title: tcIndex === 1 ? 'API: POST Login' : 'API: GET Get Users',
        });
      });

      const result = await service.import('{}', {
        ...baseImportOptions,
        importType: 'test_cases',
      });

      // Import record was created with status 'processing'
      expect(mockPrisma.postmanImport.create).toHaveBeenCalledOnce();
      expect(mockPrisma.postmanImport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'processing',
            importType: 'test_cases',
            projectId: 'proj-1',
            userId: 'user-1',
          }),
        })
      );

      // Two test cases created (one per request)
      expect(mockPrisma.testCase.create).toHaveBeenCalledTimes(2);

      // No scripts created
      expect(mockPrisma.script.create).not.toHaveBeenCalled();

      // Result shape
      expect(result.importId).toBe('import-1');
      expect(result.status).toBe('completed');
      expect(result.totalRequests).toBe(2);
      expect(result.importedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.importedItems.filter(i => i.type === 'test_case')).toHaveLength(2);
      expect(result.importedItems.filter(i => i.type === 'script')).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should create import record and scripts only when importType is scripts (also creates test case to link)', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      let tcIndex = 0;
      mockPrisma.testCase.create.mockImplementation(() => {
        tcIndex++;
        return Promise.resolve({
          id: `tc-created-${tcIndex}`,
          title: tcIndex === 1 ? 'API: POST Login' : 'API: GET Get Users',
        });
      });

      let scriptIndex = 0;
      mockPrisma.script.create.mockImplementation(() => {
        scriptIndex++;
        return Promise.resolve({
          id: `script-created-${scriptIndex}`,
          name: scriptIndex === 1 ? 'Login.spec.ts' : 'Get_Users.spec.ts',
        });
      });

      const result = await service.import('{}', {
        ...baseImportOptions,
        importType: 'scripts',
      });

      // When importType='scripts', service creates a minimal test case first (to get testCaseId),
      // then creates the script linked to it
      expect(mockPrisma.testCase.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.script.create).toHaveBeenCalledTimes(2);

      expect(result.importedCount).toBe(2);
      expect(result.importedItems.filter(i => i.type === 'script')).toHaveLength(2);
    });

    it('should create both test cases and scripts when importType is both', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      let tcIndex = 0;
      mockPrisma.testCase.create.mockImplementation(() => {
        tcIndex++;
        return Promise.resolve({
          id: `tc-created-${tcIndex}`,
          title: `TC ${tcIndex}`,
        });
      });

      let scriptIndex = 0;
      mockPrisma.script.create.mockImplementation(() => {
        scriptIndex++;
        return Promise.resolve({
          id: `script-created-${scriptIndex}`,
          name: `script_${scriptIndex}.spec.ts`,
        });
      });

      const result = await service.import('{}', {
        ...baseImportOptions,
        importType: 'both',
      });

      // 'both' creates test case AND script per request
      // test case is created first, script reuses its id — no duplicate test case
      expect(mockPrisma.testCase.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.script.create).toHaveBeenCalledTimes(2);

      expect(result.importedCount).toBe(2);
      expect(result.importedItems.filter(i => i.type === 'test_case')).toHaveLength(2);
      expect(result.importedItems.filter(i => i.type === 'script')).toHaveLength(2);
    });

    it('should update import record to completed with correct counts', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      mockPrisma.testCase.create.mockResolvedValue({
        id: 'tc-created-1',
        title: 'API: POST Login',
      });

      await service.import('{}', {
        ...baseImportOptions,
        importType: 'test_cases',
      });

      expect(mockPrisma.postmanImport.update).toHaveBeenCalledOnce();
      expect(mockPrisma.postmanImport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'import-1' },
          data: expect.objectContaining({
            status: 'completed',
            importedCount: 2,
            skippedCount: 0,
            completedAt: expect.any(Date),
            errorMessage: null,
            importedItems: expect.any(Array),
          }),
        })
      );
    });

    it('should handle per-request errors gracefully and increment skippedCount', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      // First request succeeds, second throws
      mockPrisma.testCase.create
        .mockResolvedValueOnce({ id: 'tc-created-1', title: 'API: POST Login' })
        .mockRejectedValueOnce(new Error('DB constraint violation'));

      const result = await service.import('{}', {
        ...baseImportOptions,
        importType: 'test_cases',
      });

      expect(result.status).toBe('completed');
      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Get Users');
      expect(result.errors[0]).toContain('DB constraint violation');

      // Update was still called with partial success info
      expect(mockPrisma.postmanImport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            importedCount: 1,
            skippedCount: 1,
            errorMessage: expect.stringContaining('DB constraint violation'),
          }),
        })
      );
    });

    it('should update import record to failed on total failure and re-throw', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      // Simulate a catastrophic error thrown outside the per-request try/catch.
      // The outer catch runs when the for-loop itself throws (e.g., prisma connection lost).
      // We achieve this by making the first request succeed inside the inner try,
      // but then having the update call throw in the outer try scope.
      // Actually, looking at the code — the outer catch only fires if something outside
      // the per-request try throws. Let's make postmanImport.update throw to trigger it.
      mockPrisma.testCase.create.mockResolvedValue({
        id: 'tc-created-1',
        title: 'API: POST Login',
      });
      mockPrisma.postmanImport.update
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce({ ...mockImportRecord, status: 'failed' });

      await expect(
        service.import('{}', { ...baseImportOptions, importType: 'test_cases' })
      ).rejects.toThrow('Connection lost');

      // The outer catch should attempt to update the record to 'failed'
      expect(mockPrisma.postmanImport.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.postmanImport.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: 'import-1' },
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: 'Connection lost',
          }),
        })
      );
    });

    it('should apply variable mapping to URLs when provided', async () => {
      const parsed = buildParsedCollection();
      mockPostmanParser.parse.mockReturnValue(parsed);

      let capturedSteps: unknown = null;
      mockPrisma.testCase.create.mockImplementation((args: { data: { steps: unknown } }) => {
        // Capture the first call's steps to inspect variable replacement
        if (!capturedSteps) {
          capturedSteps = args.data.steps;
        }
        return Promise.resolve({ id: 'tc-created-1', title: 'API: POST Login' });
      });

      await service.import('{}', {
        ...baseImportOptions,
        importType: 'test_cases',
        variableMapping: { baseUrl: 'https://staging.example.com' },
      });

      // The steps should contain the replaced URL
      const steps = capturedSteps as Array<{ order: number; action: string; expected: string }>;
      const prepareStep = steps.find(s => s.action.includes('Prepare'));
      expect(prepareStep).toBeDefined();
      expect(prepareStep!.action).toContain('https://staging.example.com/auth/login');
      expect(prepareStep!.action).not.toContain('{{baseUrl}}');
    });
  });

  // ==========================================================================
  // getImportHistory()
  // ==========================================================================

  describe('getImportHistory', () => {
    it('should return imports for project ordered by date with default limit', async () => {
      const imports = [
        { ...mockImportRecord, id: 'import-2', createdAt: new Date('2026-02-02') },
        { ...mockImportRecord, id: 'import-1', createdAt: new Date('2026-02-01') },
      ];
      mockPrisma.postmanImport.findMany.mockResolvedValue(imports);

      const result = await service.getImportHistory('proj-1');

      expect(mockPrisma.postmanImport.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      expect(result).toEqual(imports);
      expect(result).toHaveLength(2);
    });

    it('should respect custom limit parameter', async () => {
      mockPrisma.postmanImport.findMany.mockResolvedValue([]);

      await service.getImportHistory('proj-1', 5);

      expect(mockPrisma.postmanImport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  // ==========================================================================
  // getImport()
  // ==========================================================================

  describe('getImport', () => {
    it('should return import record by ID', async () => {
      mockPrisma.postmanImport.findUnique.mockResolvedValue(mockImportRecord);

      const result = await service.getImport('import-1');

      expect(mockPrisma.postmanImport.findUnique).toHaveBeenCalledWith({
        where: { id: 'import-1' },
      });
      expect(result).toEqual(mockImportRecord);
    });

    it('should throw NotFoundError when import does not exist', async () => {
      mockPrisma.postmanImport.findUnique.mockResolvedValue(null);

      await expect(service.getImport('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(service.getImport('nonexistent')).rejects.toThrow(
        "PostmanImport with id 'nonexistent' not found"
      );
    });
  });
});
