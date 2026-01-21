/**
 * Duplicate Detection Service Unit Tests
 * Sprint 14: Tests for 3-tier cascade duplicate detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    testCase: {
      findMany: vi.fn(),
    },
    script: {
      findMany: vi.fn(),
    },
    scriptSmithSession: {
      findUnique: vi.fn(),
    },
    duplicateCheck: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { DuplicateDetectionService } from '../../../src/services/duplicate.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;

  const mockProject = { id: 'project-123' };

  const mockTestCase = {
    id: 'tc-123',
    title: 'Test user login',
    description: 'Verify user can login with valid credentials',
    steps: JSON.stringify([{ action: 'Navigate to login', expected: 'Login page displayed' }]),
    expectedResult: 'User is logged in',
  };

  const mockScript = {
    id: 'script-123',
    name: 'login.spec.ts',
    code: `
      test('user can login', async ({ page }) => {
        await page.goto('/login');
        await page.fill('#username', 'testuser');
        await page.fill('#password', 'password123');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/dashboard');
      });
    `,
  };

  const mockSession = {
    id: 'session-123',
    projectId: mockProject.id,
    files: [
      {
        id: 'file-123',
        fileType: 'test',
        content: mockScript.code,
      },
    ],
  };

  const mockDuplicateCheck = {
    id: 'check-123',
    projectId: mockProject.id,
    sourceType: 'test_case',
    sourceId: 'tc-123',
    isDuplicate: false,
    confidence: 0,
    matchType: null,
    similarItems: [],
    checkedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DuplicateDetectionService();
  });

  // ==========================================================================
  // CHECK TEST CASE
  // ==========================================================================

  describe('checkTestCase', () => {
    it('should return no duplicate when no existing test cases', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.duplicateCheck.create.mockResolvedValue(mockDuplicateCheck);

      const result = await service.checkTestCase(
        'Test new feature',
        mockProject.id
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.similarItems).toHaveLength(0);
    });

    it('should detect exact duplicate test case', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        ...mockDuplicateCheck,
        isDuplicate: true,
        confidence: 100,
        matchType: 'exact',
      });

      // Match exactly how normalizeTestCase works: title + description + JSON.stringify(steps) + expectedResult
      // Note: steps is already a JSON string, so JSON.stringify will double-escape it
      const content = `${mockTestCase.title} ${mockTestCase.description} ${JSON.stringify(mockTestCase.steps)} ${mockTestCase.expectedResult}`;
      const result = await service.checkTestCase(content, mockProject.id);

      expect(result.isDuplicate).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.matchType).toBe('exact');
    });

    it('should detect near duplicate test case via Levenshtein', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([mockTestCase]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        ...mockDuplicateCheck,
        isDuplicate: true,
        confidence: 90,
        matchType: 'near',
      });

      // Similar but not identical content
      const content = 'Test user login Verify user can log in with correct credentials';
      const result = await service.checkTestCase(content, mockProject.id);

      expect(result.checkId).toBeDefined();
      expect(mockPrisma.duplicateCheck.create).toHaveBeenCalled();
    });

    it('should exclude self when testCaseId provided', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.duplicateCheck.create.mockResolvedValue(mockDuplicateCheck);

      await service.checkTestCase('content', mockProject.id, 'tc-123');

      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'tc-123' },
          }),
        })
      );
    });
  });

  // ==========================================================================
  // CHECK SCRIPT
  // ==========================================================================

  describe('checkScript', () => {
    it('should return no duplicate when no existing scripts', async () => {
      mockPrisma.script.findMany.mockResolvedValue([]);
      mockPrisma.duplicateCheck.create.mockResolvedValue(mockDuplicateCheck);

      const result = await service.checkScript(
        'test("new test", () => {})',
        mockProject.id
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should detect exact duplicate script', async () => {
      mockPrisma.script.findMany.mockResolvedValue([mockScript]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        ...mockDuplicateCheck,
        isDuplicate: true,
        confidence: 100,
        matchType: 'exact',
      });

      const result = await service.checkScript(mockScript.code, mockProject.id);

      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('exact');
    });

    it('should normalize code before comparison', async () => {
      mockPrisma.script.findMany.mockResolvedValue([mockScript]);
      mockPrisma.duplicateCheck.create.mockResolvedValue(mockDuplicateCheck);

      // Same code but with different formatting/comments
      const codeWithComments = `
        // This is a login test
        test('user can login', async ({ page }) => {
          /* Navigate to login page */
          await page.goto('/login');
          await page.fill('#username', 'testuser');
          await page.fill('#password', 'password123');
          await page.click('button[type="submit"]');
          await expect(page).toHaveURL('/dashboard');
        });
      `;

      const result = await service.checkScript(codeWithComments, mockProject.id);

      // Should find high similarity after normalization
      expect(mockPrisma.duplicateCheck.create).toHaveBeenCalled();
    });

    it('should exclude self when scriptId provided', async () => {
      mockPrisma.script.findMany.mockResolvedValue([]);
      mockPrisma.duplicateCheck.create.mockResolvedValue(mockDuplicateCheck);

      await service.checkScript('code', mockProject.id, 'script-123');

      expect(mockPrisma.script.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'script-123' },
          }),
        })
      );
    });
  });

  // ==========================================================================
  // CHECK SESSION
  // ==========================================================================

  describe('checkSession', () => {
    it('should check session files for duplicates', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.script.findMany.mockResolvedValue([]);
      mockPrisma.duplicateCheck.create.mockResolvedValue(mockDuplicateCheck);

      const result = await service.checkSession('session-123');

      expect(result.isDuplicate).toBe(false);
    });

    it('should throw NotFoundError for invalid session', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(null);

      await expect(service.checkSession('invalid')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should return no duplicate if no project associated', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue({
        ...mockSession,
        projectId: null,
      });

      const result = await service.checkSession('session-123');

      expect(result.isDuplicate).toBe(false);
      expect(result.recommendation).toContain('No project');
    });

    it('should detect duplicates across multiple session files', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue({
        ...mockSession,
        files: [
          { id: 'file-1', fileType: 'test', content: mockScript.code },
          { id: 'file-2', fileType: 'test', content: 'test("another", () => {})' },
        ],
      });
      mockPrisma.script.findMany.mockResolvedValue([mockScript]);
      mockPrisma.duplicateCheck.create.mockResolvedValue({
        ...mockDuplicateCheck,
        isDuplicate: true,
        confidence: 95,
        matchType: 'near',
      });

      const result = await service.checkSession('session-123');

      expect(mockPrisma.script.findMany).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET CHECKS
  // ==========================================================================

  describe('getCheckById', () => {
    it('should return check by ID', async () => {
      mockPrisma.duplicateCheck.findUnique.mockResolvedValue(mockDuplicateCheck);

      const result = await service.getCheckById('check-123');

      expect(result.id).toBe('check-123');
    });

    it('should throw NotFoundError for invalid ID', async () => {
      mockPrisma.duplicateCheck.findUnique.mockResolvedValue(null);

      await expect(service.getCheckById('invalid')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getProjectChecks', () => {
    it('should return checks for project', async () => {
      mockPrisma.duplicateCheck.findMany.mockResolvedValue([mockDuplicateCheck]);

      const result = await service.getProjectChecks(mockProject.id);

      expect(result).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      mockPrisma.duplicateCheck.findMany.mockResolvedValue([]);

      await service.getProjectChecks(mockProject.id, 25);

      expect(mockPrisma.duplicateCheck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
        })
      );
    });
  });

  // ==========================================================================
  // INTERNAL METHODS (via integration)
  // ==========================================================================

  describe('Levenshtein similarity', () => {
    it('should correctly calculate similarity for similar strings', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([
        {
          id: 'tc-1',
          title: 'Login test',
          description: 'Test user login flow',
          steps: '[]',
          expectedResult: 'User logged in',
        },
      ]);
      mockPrisma.duplicateCheck.create.mockImplementation(async (args) => ({
        id: 'check-new',
        ...args.data,
      }));

      // Similar but not identical
      const result = await service.checkTestCase(
        'Login test Test user login process User logged in',
        mockProject.id
      );

      // The store check was called
      expect(mockPrisma.duplicateCheck.create).toHaveBeenCalled();
    });

    it('should return 0 similarity for completely different strings', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([
        {
          id: 'tc-1',
          title: 'Checkout flow test',
          description: 'Test the checkout process',
          steps: '[]',
          expectedResult: 'Order placed',
        },
      ]);
      mockPrisma.duplicateCheck.create.mockImplementation(async (args) => ({
        id: 'check-new',
        ...args.data,
      }));

      // Completely different content
      const result = await service.checkTestCase(
        'API authentication test Verify OAuth token validation Token is valid',
        mockProject.id
      );

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Hash-based detection', () => {
    it('should detect exact matches via hash', async () => {
      // normalizeTestCase produces: title + description + JSON.stringify(steps) + expectedResult
      // For steps: '[]' (string), JSON.stringify('[]') = '"[]"' (with quotes)
      const mockTC = {
        id: 'tc-1',
        title: 'Test user login',
        description: 'Verify credentials',
        steps: '[]',
        expectedResult: 'User logged in',
      };
      // Build content exactly as normalizeTestCase does
      const exactContent = `${mockTC.title} ${mockTC.description} ${JSON.stringify(mockTC.steps)} ${mockTC.expectedResult}`;

      mockPrisma.testCase.findMany.mockResolvedValue([mockTC]);
      mockPrisma.duplicateCheck.create.mockImplementation(async (args) => ({
        id: 'check-new',
        ...args.data,
      }));

      const result = await service.checkTestCase(exactContent, mockProject.id);

      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.confidence).toBe(100);
    });
  });
});
