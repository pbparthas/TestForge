/**
 * Bug Service Unit Tests
 * Tests for bug tracking, creation from failures, external sync, and pattern analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    bug: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    executionResult: {
      findUnique: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/utils/logger.js', () => ({ logger: mockLogger }));

import { BugService } from '../../../src/services/bug.service.js';
import { NotFoundError } from '../../../src/errors/index.js';

describe('BugService', () => {
  let service: BugService;

  const now = new Date('2026-02-08T12:00:00Z');

  const mockBug = {
    id: 'bug-1',
    projectId: 'proj-1',
    title: 'Login button missing',
    description: 'The login button is not rendered',
    status: 'open',
    priority: 'high',
    linkedTestCaseId: 'tc-1',
    linkedExecutionId: 'exec-1',
    externalId: null,
    createdAt: now,
    updatedAt: now,
    testCase: { id: 'tc-1', title: 'Login Test' },
    project: { id: 'proj-1', name: 'Test Project' },
  };

  const mockExecutionResult = {
    id: 'result-1',
    executionId: 'exec-1',
    testCaseId: 'tc-1',
    status: 'failed',
    errorMessage: 'Element not found: #login-button',
    errorStack: 'Error: Element not found\n  at findElement (test.js:42)',
    testCase: { title: 'Login Test' },
    execution: { id: 'exec-1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BugService();
  });

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should create a bug with defaults (status=open, priority=medium)', async () => {
      const input = { projectId: 'proj-1', title: 'New Bug' };
      const expected = { ...mockBug, title: 'New Bug', priority: 'medium', description: null };
      mockPrisma.bug.create.mockResolvedValue(expected);

      const result = await service.create(input);

      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          title: 'New Bug',
          priority: 'medium',
          status: 'open',
        },
      });
      expect(result).toEqual(expected);
    });

    it('should create a bug with all optional fields', async () => {
      const input = {
        projectId: 'proj-1',
        title: 'Full Bug',
        description: 'Detailed description',
        priority: 'critical' as const,
        linkedTestCaseId: 'tc-1',
        linkedExecutionId: 'exec-1',
        externalId: 'JIRA-123',
      };
      const expected = { ...mockBug, ...input };
      mockPrisma.bug.create.mockResolvedValue(expected);

      const result = await service.create(input);

      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          title: 'Full Bug',
          description: 'Detailed description',
          priority: 'critical',
          linkedTestCaseId: 'tc-1',
          linkedExecutionId: 'exec-1',
          externalId: 'JIRA-123',
          status: 'open',
        },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('findById', () => {
    it('should return bug with testCase and project included', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(mockBug);

      const result = await service.findById('bug-1');

      expect(mockPrisma.bug.findUnique).toHaveBeenCalledWith({
        where: { id: 'bug-1' },
        include: { testCase: true, project: true },
      });
      expect(result).toEqual(mockBug);
    });

    it('should throw NotFoundError when bug does not exist', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(service.findById('nonexistent')).rejects.toThrow(
        "Bug with id 'nonexistent' not found"
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results with filters applied', async () => {
      const bugs = [mockBug];
      mockPrisma.bug.findMany.mockResolvedValue(bugs);
      mockPrisma.bug.count.mockResolvedValue(1);

      const params = {
        page: 1,
        limit: 10,
        projectId: 'proj-1',
        status: 'open' as const,
        priority: 'high' as const,
        linkedTestCaseId: 'tc-1',
      };

      const result = await service.findAll(params);

      expect(mockPrisma.bug.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          status: 'open',
          priority: 'high',
          linkedTestCaseId: 'tc-1',
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { testCase: { select: { id: true, title: true } } },
      });
      expect(mockPrisma.bug.count).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          status: 'open',
          priority: 'high',
          linkedTestCaseId: 'tc-1',
        },
      });
      expect(result).toEqual({
        data: bugs,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should calculate correct skip and totalPages for page 2', async () => {
      mockPrisma.bug.findMany.mockResolvedValue([]);
      mockPrisma.bug.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(mockPrisma.bug.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
      expect(result.totalPages).toBe(3);
    });
  });

  describe('update', () => {
    it('should update an existing bug', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(mockBug);
      const updated = { ...mockBug, title: 'Updated Title', priority: 'critical' };
      mockPrisma.bug.update.mockResolvedValue(updated);

      const result = await service.update('bug-1', { title: 'Updated Title', priority: 'critical' as const });

      expect(mockPrisma.bug.findUnique).toHaveBeenCalledWith({ where: { id: 'bug-1' } });
      expect(mockPrisma.bug.update).toHaveBeenCalledWith({
        where: { id: 'bug-1' },
        data: { title: 'Updated Title', priority: 'critical' },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when updating a nonexistent bug', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { title: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete an existing bug', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(mockBug);
      mockPrisma.bug.delete.mockResolvedValue(mockBug);

      await service.delete('bug-1');

      expect(mockPrisma.bug.findUnique).toHaveBeenCalledWith({ where: { id: 'bug-1' } });
      expect(mockPrisma.bug.delete).toHaveBeenCalledWith({ where: { id: 'bug-1' } });
    });

    it('should throw NotFoundError when deleting a nonexistent bug', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.bug.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // createFromFailure
  // ---------------------------------------------------------------------------

  describe('createFromFailure', () => {
    it('should create bug from failed executionResult with autoTitle=true', async () => {
      mockPrisma.executionResult.findUnique.mockResolvedValue(mockExecutionResult);
      mockPrisma.bug.findFirst.mockResolvedValue(null); // no existing bug
      const createdBug = {
        ...mockBug,
        title: '[Auto] Login Test failed: Element not found: #login-button',
        priority: 'high',
      };
      mockPrisma.bug.create.mockResolvedValue(createdBug);

      const result = await service.createFromFailure({
        executionResultId: 'result-1',
        projectId: 'proj-1',
        autoTitle: true,
      });

      expect(mockPrisma.executionResult.findUnique).toHaveBeenCalledWith({
        where: { id: 'result-1' },
        include: { testCase: true, execution: true },
      });
      expect(mockPrisma.bug.findFirst).toHaveBeenCalledWith({
        where: {
          linkedTestCaseId: 'tc-1',
          status: { in: ['open', 'in_progress'] },
        },
      });
      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          title: '[Auto] Login Test failed: Element not found: #login-button',
          priority: 'high',
          linkedTestCaseId: 'tc-1',
          linkedExecutionId: 'exec-1',
          status: 'open',
        }),
      });
      expect(result).toEqual(createdBug);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { bugId: createdBug.id, resultId: 'result-1' },
        'Bug created from failure'
      );
    });

    it('should create bug from error executionResult', async () => {
      const errorResult = { ...mockExecutionResult, status: 'error', errorMessage: 'Script crashed' };
      mockPrisma.executionResult.findUnique.mockResolvedValue(errorResult);
      mockPrisma.bug.findFirst.mockResolvedValue(null);
      const createdBug = { ...mockBug, title: '[Auto] Login Test failed: Script crashed' };
      mockPrisma.bug.create.mockResolvedValue(createdBug);

      const result = await service.createFromFailure({
        executionResultId: 'result-1',
        projectId: 'proj-1',
        autoTitle: true,
      });

      expect(result).toEqual(createdBug);
      expect(mockPrisma.bug.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError when executionResult does not exist', async () => {
      mockPrisma.executionResult.findUnique.mockResolvedValue(null);

      await expect(
        service.createFromFailure({ executionResultId: 'missing', projectId: 'proj-1' })
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.createFromFailure({ executionResultId: 'missing', projectId: 'proj-1' })
      ).rejects.toThrow("ExecutionResult with id 'missing' not found");
    });

    it('should throw Error when executionResult status is not failed or error', async () => {
      const passedResult = { ...mockExecutionResult, status: 'passed' };
      mockPrisma.executionResult.findUnique.mockResolvedValue(passedResult);

      await expect(
        service.createFromFailure({ executionResultId: 'result-1', projectId: 'proj-1' })
      ).rejects.toThrow('Can only create bug from failed/error results');
    });

    it('should return existing open bug instead of creating a duplicate', async () => {
      mockPrisma.executionResult.findUnique.mockResolvedValue(mockExecutionResult);
      const existingBug = { ...mockBug, id: 'existing-bug' };
      mockPrisma.bug.findFirst.mockResolvedValue(existingBug);

      const result = await service.createFromFailure({
        executionResultId: 'result-1',
        projectId: 'proj-1',
        autoTitle: true,
      });

      expect(result).toEqual(existingBug);
      expect(mockPrisma.bug.create).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        { bugId: 'existing-bug', testCaseId: 'tc-1' },
        'Bug already exists for test case'
      );
    });

    it('should create bug with generic title when autoTitle is false', async () => {
      mockPrisma.executionResult.findUnique.mockResolvedValue(mockExecutionResult);
      mockPrisma.bug.findFirst.mockResolvedValue(null);
      const createdBug = { ...mockBug, title: 'Test failure: Login Test' };
      mockPrisma.bug.create.mockResolvedValue(createdBug);

      const result = await service.createFromFailure({
        executionResultId: 'result-1',
        projectId: 'proj-1',
        autoTitle: false,
      });

      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Test failure: Login Test',
        }),
      });
      expect(result).toEqual(createdBug);
    });

    it('should truncate error message to 100 chars in autoTitle', async () => {
      const longError = 'A'.repeat(200);
      const longResult = { ...mockExecutionResult, errorMessage: longError };
      mockPrisma.executionResult.findUnique.mockResolvedValue(longResult);
      mockPrisma.bug.findFirst.mockResolvedValue(null);
      mockPrisma.bug.create.mockResolvedValue(mockBug);

      await service.createFromFailure({
        executionResultId: 'result-1',
        projectId: 'proj-1',
        autoTitle: true,
      });

      const createCall = mockPrisma.bug.create.mock.calls[0][0];
      const title = createCall.data.title as string;
      // The title format is "[Auto] Login Test failed: " + first 100 chars of error
      const errorPortion = title.split('failed: ')[1];
      expect(errorPortion.length).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // linkToExternal
  // ---------------------------------------------------------------------------

  describe('linkToExternal', () => {
    it('should update bug with external id', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(mockBug);
      const linkedBug = { ...mockBug, externalId: 'JIRA-456' };
      mockPrisma.bug.update.mockResolvedValue(linkedBug);

      const result = await service.linkToExternal('bug-1', 'JIRA-456');

      expect(mockPrisma.bug.findUnique).toHaveBeenCalledWith({ where: { id: 'bug-1' } });
      expect(mockPrisma.bug.update).toHaveBeenCalledWith({
        where: { id: 'bug-1' },
        data: { externalId: 'JIRA-456' },
      });
      expect(result).toEqual(linkedBug);
    });

    it('should throw NotFoundError when bug does not exist', async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(null);

      await expect(service.linkToExternal('nonexistent', 'JIRA-456')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.bug.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findByExternalId
  // ---------------------------------------------------------------------------

  describe('findByExternalId', () => {
    it('should return bug matching external id', async () => {
      mockPrisma.bug.findFirst.mockResolvedValue(mockBug);

      const result = await service.findByExternalId('JIRA-123');

      expect(mockPrisma.bug.findFirst).toHaveBeenCalledWith({
        where: { externalId: 'JIRA-123' },
      });
      expect(result).toEqual(mockBug);
    });

    it('should return null when no bug matches', async () => {
      mockPrisma.bug.findFirst.mockResolvedValue(null);

      const result = await service.findByExternalId('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getProjectStats
  // ---------------------------------------------------------------------------

  describe('getProjectStats', () => {
    it('should return counts by status and priority', async () => {
      const bugs = [
        { status: 'open', priority: 'critical' },
        { status: 'open', priority: 'high' },
        { status: 'open', priority: 'high' },
        { status: 'in_progress', priority: 'medium' },
        { status: 'resolved', priority: 'low' },
        { status: 'resolved', priority: 'medium' },
        { status: 'closed', priority: 'low' },
      ];
      mockPrisma.bug.findMany.mockResolvedValue(bugs);

      const result = await service.getProjectStats('proj-1');

      expect(mockPrisma.bug.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
      });
      expect(result).toEqual({
        total: 7,
        open: 3,
        inProgress: 1,
        resolved: 2,
        closed: 1,
        byPriority: {
          critical: 1,
          high: 2,
          medium: 2,
          low: 2,
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // analyzePatterns
  // ---------------------------------------------------------------------------

  describe('analyzePatterns', () => {
    it('should classify bugs by regex patterns and return sorted by count desc', async () => {
      const date1 = new Date('2026-02-07T10:00:00Z');
      const date2 = new Date('2026-02-08T10:00:00Z');
      const date3 = new Date('2026-02-06T10:00:00Z');

      const bugs = [
        {
          title: 'Element not found: #submit-btn',
          description: 'selector failed',
          createdAt: date1,
          testCase: { title: 'Submit Test' },
        },
        {
          title: 'Timeout waiting for element',
          description: 'Timed out after 30s',
          createdAt: date2,
          testCase: { title: 'Checkout Test' },
        },
        {
          title: 'Selector issue on login page',
          description: 'element not found',
          createdAt: date3,
          testCase: { title: 'Login Test' },
        },
        {
          title: 'Network request failed',
          description: 'API returned 500',
          createdAt: date1,
          testCase: { title: 'API Test' },
        },
        {
          title: 'Auth token expired',
          description: 'authentication error on login',
          createdAt: date1,
          testCase: { title: 'Auth Test' },
        },
      ];
      mockPrisma.bug.findMany.mockResolvedValue(bugs);

      const result = await service.analyzePatterns('proj-1');

      expect(mockPrisma.bug.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', status: { in: ['open', 'in_progress'] } },
        include: { testCase: true },
        orderBy: { createdAt: 'desc' },
      });

      // Selector Issues matches bugs 0 and 2 => count 2
      // Timeout Issues matches bug 1 => count 1
      // Network Issues matches bug 3 => count 1
      // Authentication Issues matches bugs 4 AND 2 (description has "login") => auth matches bug 4 title "Auth" and bug 2 description "login"
      // Actually let's check: bug 2 description is "element not found" and title "Selector issue on login page"
      // /authentication|login|auth/i on title "Selector issue on login page" => matches "login"
      // So bug 2 matches BOTH Selector Issues AND Authentication Issues

      // Selector: bugs 0 (title "Element not found"), 2 (title "Selector issue") => count 2
      // Auth: bug 2 (title has "login"), bug 4 (title has "Auth", description has "authentication" and "login") => count 2
      // Timeout: bug 1 => count 1
      // Network: bug 3 (title "Network", description "API") => count 1

      // Sort by count desc, then same-count order is map insertion order
      expect(result.length).toBeGreaterThanOrEqual(4);

      const selectorPattern = result.find(p => p.pattern === 'Selector Issues');
      expect(selectorPattern).toBeDefined();
      expect(selectorPattern!.count).toBe(2);
      expect(selectorPattern!.testCases).toContain('Submit Test');
      expect(selectorPattern!.testCases).toContain('Login Test');

      const authPattern = result.find(p => p.pattern === 'Authentication Issues');
      expect(authPattern).toBeDefined();
      expect(authPattern!.count).toBe(2);
      expect(authPattern!.testCases).toContain('Auth Test');

      const timeoutPattern = result.find(p => p.pattern === 'Timeout Issues');
      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern!.count).toBe(1);
      expect(timeoutPattern!.testCases).toContain('Checkout Test');

      const networkPattern = result.find(p => p.pattern === 'Network Issues');
      expect(networkPattern).toBeDefined();
      expect(networkPattern!.count).toBe(1);

      // First two should have count 2, last two count 1
      expect(result[0].count).toBeGreaterThanOrEqual(result[1].count);
      expect(result[1].count).toBeGreaterThanOrEqual(result[2].count);
    });

    it('should return empty array when no open bugs exist', async () => {
      mockPrisma.bug.findMany.mockResolvedValue([]);

      const result = await service.analyzePatterns('proj-1');

      expect(result).toEqual([]);
    });
  });
});
