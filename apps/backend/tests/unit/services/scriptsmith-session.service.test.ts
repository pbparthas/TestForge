/**
 * ScriptSmith Session Service Unit Tests
 * Sprint 13: Session-based workflow tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// All mocks must be hoisted
const { mockPrisma, mockScriptSmithAgent, mockAiUsageService, mockFrameworkAnalysisService } = vi.hoisted(() => ({
  mockPrisma: {
    scriptSmithSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    scriptSmithFile: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockScriptSmithAgent: {
    generate: vi.fn(),
    edit: vi.fn(),
  },
  mockAiUsageService: {
    record: vi.fn(),
  },
  mockFrameworkAnalysisService: {
    analyzeProject: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../src/agents/scriptsmith.agent.js', () => ({
  scriptSmithAgent: mockScriptSmithAgent,
}));
vi.mock('../../../src/services/aiusage.service.js', () => ({
  aiUsageService: mockAiUsageService,
}));
vi.mock('../../../src/services/framework-analysis.service.js', () => ({
  frameworkAnalysisService: mockFrameworkAnalysisService,
}));

import { ScriptSmithSessionService } from '../../../src/services/scriptsmith-session.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('ScriptSmithSessionService', () => {
  let service: ScriptSmithSessionService;

  const mockUser = { id: 'user-123', name: 'Test User' };
  const mockProject = { id: 'project-123', name: 'Test Project' };

  const mockSession = {
    id: 'session-123',
    userId: mockUser.id,
    projectId: mockProject.id,
    inputMethod: 'describe' as const,
    status: 'created' as const,
    rawInput: null,
    transformedScript: null,
    frameworkAnalysis: null,
    costEstimate: null,
    projectPath: '/path/to/project',
    deviceType: null,
    deviceConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  const mockSessionWithFiles = {
    ...mockSession,
    files: [
      {
        id: 'file-1',
        sessionId: mockSession.id,
        filePath: 'tests/example.spec.ts',
        fileType: 'test' as const,
        content: 'test code',
        imports: [],
        exports: [],
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ScriptSmithSessionService();
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe('create', () => {
    it('should create a session with required fields', async () => {
      mockPrisma.scriptSmithSession.create.mockResolvedValue(mockSession);

      const result = await service.create({
        userId: mockUser.id,
        inputMethod: 'describe',
      });

      expect(result).toEqual(mockSession);
      expect(mockPrisma.scriptSmithSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user: { connect: { id: mockUser.id } },
          inputMethod: 'describe',
          status: 'created',
        }),
      });
    });

    it('should create a session with all optional fields', async () => {
      mockPrisma.scriptSmithSession.create.mockResolvedValue(mockSession);

      const result = await service.create({
        userId: mockUser.id,
        projectId: mockProject.id,
        inputMethod: 'record',
        projectPath: '/path/to/project',
        deviceType: 'desktop',
        deviceConfig: { browser: 'chromium' },
      });

      expect(result).toEqual(mockSession);
      expect(mockPrisma.scriptSmithSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user: { connect: { id: mockUser.id } },
          project: { connect: { id: mockProject.id } },
          inputMethod: 'record',
          projectPath: '/path/to/project',
          deviceType: 'desktop',
          deviceConfig: { browser: 'chromium' },
        }),
      });
    });

    it('should create sessions for all input methods', async () => {
      const inputMethods = ['record', 'upload', 'screenshot', 'describe', 'edit'] as const;

      for (const method of inputMethods) {
        mockPrisma.scriptSmithSession.create.mockResolvedValue({
          ...mockSession,
          inputMethod: method,
        });

        const result = await service.create({
          userId: mockUser.id,
          inputMethod: method,
        });

        expect(result.inputMethod).toBe(method);
      }
    });
  });

  // ==========================================================================
  // FIND BY ID
  // ==========================================================================

  describe('findById', () => {
    it('should return session by id', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.findById(mockSession.id);

      expect(result).toEqual(mockSession);
      expect(mockPrisma.scriptSmithSession.findUnique).toHaveBeenCalledWith({
        where: { id: mockSession.id },
      });
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND BY ID WITH FILES
  // ==========================================================================

  describe('findByIdWithFiles', () => {
    it('should return session with files', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(mockSessionWithFiles);

      const result = await service.findByIdWithFiles(mockSession.id);

      expect(result).toEqual(mockSessionWithFiles);
      expect(result.files.length).toBe(1);
      expect(mockPrisma.scriptSmithSession.findUnique).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        include: { files: true },
      });
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(null);

      await expect(service.findByIdWithFiles('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // FIND ALL
  // ==========================================================================

  describe('findAll', () => {
    it('should return paginated sessions', async () => {
      const sessions = [mockSession];
      mockPrisma.scriptSmithSession.findMany.mockResolvedValue(sessions);
      mockPrisma.scriptSmithSession.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(sessions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by userId', async () => {
      mockPrisma.scriptSmithSession.findMany.mockResolvedValue([]);
      mockPrisma.scriptSmithSession.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, userId: mockUser.id });

      expect(mockPrisma.scriptSmithSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: mockUser.id }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.scriptSmithSession.findMany.mockResolvedValue([]);
      mockPrisma.scriptSmithSession.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: 'completed' });

      expect(mockPrisma.scriptSmithSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed' }),
        })
      );
    });
  });

  // ==========================================================================
  // UPDATE INPUT
  // ==========================================================================

  describe('updateInput', () => {
    it('should update session with description input', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.scriptSmithSession.update.mockResolvedValue({
        ...mockSession,
        status: 'input_received',
        rawInput: { description: 'Generate a login test' },
      });

      const result = await service.updateInput(mockSession.id, {
        description: 'Generate a login test',
      });

      expect(result.status).toBe('input_received');
      expect(mockPrisma.scriptSmithSession.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: {
          rawInput: { description: 'Generate a login test' },
          status: 'input_received',
        },
      });
    });

    it('should reject invalid input for method', async () => {
      const recordSession = { ...mockSession, inputMethod: 'record' as const };
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(recordSession);

      await expect(
        service.updateInput(mockSession.id, { description: 'test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject update from invalid status', async () => {
      const completedSession = { ...mockSession, status: 'completed' as const };
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(completedSession);

      await expect(
        service.updateInput(mockSession.id, { description: 'test' })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // TRANSFORM
  // ==========================================================================

  describe('transform', () => {
    it('should transform session and create files', async () => {
      const sessionWithInput = {
        ...mockSession,
        status: 'input_received' as const,
        rawInput: { description: 'Generate a login test' },
        files: [],
      };

      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(sessionWithInput);
      mockPrisma.scriptSmithSession.update.mockResolvedValue({
        ...sessionWithInput,
        status: 'reviewing',
        files: [{ id: 'file-1', filePath: 'tests/test.spec.ts', content: 'code' }],
      });
      mockPrisma.scriptSmithFile.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scriptSmithFile.create.mockResolvedValue({
        id: 'file-1',
        sessionId: mockSession.id,
        filePath: 'tests/test.spec.ts',
        fileType: 'test',
        content: 'code',
        imports: [],
        exports: [],
        createdAt: new Date(),
      });

      mockScriptSmithAgent.generate.mockResolvedValue({
        data: {
          name: 'test',
          code: 'test code',
          language: 'typescript',
          framework: 'playwright',
        },
        usage: {
          model: 'claude-sonnet-4',
          inputTokens: 100,
          outputTokens: 200,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costUsd: 0.001,
          costInr: 0.08,
          durationMs: 1000,
        },
      });

      mockFrameworkAnalysisService.analyzeProject.mockResolvedValue({
        foundPageObjects: [],
        foundUtilities: [],
        foundFixtures: [],
        projectStructure: {
          rootDir: '/path',
          testDir: '/path/tests',
          pageObjectDir: null,
          utilityDir: null,
          fixtureDir: null,
          configFile: null,
        },
        codingStyle: {
          indentation: 'spaces',
          indentSize: 2,
          quotesStyle: 'single',
          semicolons: true,
          trailingComma: true,
        },
        framework: { name: 'playwright', version: '1.0.0', language: 'typescript' },
        testCount: 0,
      });

      const result = await service.transform(
        mockSession.id,
        { framework: 'playwright', language: 'typescript' },
        mockProject.id
      );

      expect(result.status).toBe('reviewing');
      expect(mockScriptSmithAgent.generate).toHaveBeenCalled();
      expect(mockAiUsageService.record).toHaveBeenCalled();
    });

    it('should reject transform from invalid status', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'completed' as const,
        files: [],
      });

      await expect(
        service.transform(mockSession.id, {}, mockProject.id)
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // SAVE TO FRAMEWORK
  // ==========================================================================

  describe('saveToFramework', () => {
    it('should save files and mark session completed', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue({
        ...mockSessionWithFiles,
        status: 'reviewing' as const,
      });
      mockPrisma.scriptSmithSession.update.mockResolvedValue({
        ...mockSessionWithFiles,
        status: 'completed',
        completedAt: new Date(),
      });

      const result = await service.saveToFramework(
        mockSession.id,
        '/output/dir',
        false
      );

      expect(result.savedFiles.length).toBe(1);
      expect(result.sessionId).toBe(mockSession.id);
      expect(mockPrisma.scriptSmithSession.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: expect.objectContaining({
          status: 'completed',
        }),
      });
    });

    it('should reject save from invalid status', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue({
        ...mockSessionWithFiles,
        status: 'created' as const,
      });

      await expect(
        service.saveToFramework(mockSession.id, '/output', false)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject save when no files', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: 'reviewing' as const,
        files: [],
      });

      await expect(
        service.saveToFramework(mockSession.id, '/output', false)
      ).rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe('delete', () => {
    it('should delete session', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.scriptSmithSession.delete.mockResolvedValue(mockSession);

      await service.delete(mockSession.id);

      expect(mockPrisma.scriptSmithSession.delete).toHaveBeenCalledWith({
        where: { id: mockSession.id },
      });
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.scriptSmithSession.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // ANALYZE FRAMEWORK
  // ==========================================================================

  describe('analyzeFramework', () => {
    it('should return framework analysis', async () => {
      mockFrameworkAnalysisService.analyzeProject.mockResolvedValue({
        foundPageObjects: [{ name: 'LoginPage', filePath: '/pages/login.ts', methods: [], selectors: [] }],
        foundUtilities: [{ name: 'helpers', filePath: '/utils/helpers.ts', exports: [] }],
        foundFixtures: [],
        projectStructure: {
          rootDir: '/project',
          testDir: '/project/tests',
          pageObjectDir: '/project/pages',
          utilityDir: '/project/utils',
          fixtureDir: null,
          configFile: '/project/playwright.config.ts',
        },
        codingStyle: {
          indentation: 'spaces',
          indentSize: 2,
          quotesStyle: 'single',
          semicolons: true,
          trailingComma: true,
        },
        framework: { name: 'playwright', version: '1.40.0', language: 'typescript' },
        testCount: 5,
      });

      const result = await service.analyzeFramework('/project');

      expect(result.foundPageObjects).toContain('LoginPage');
      expect(result.foundUtilities).toContain('helpers');
      expect(result.projectStructure.testDir).toBe('/project/tests');
    });

    it('should return defaults on analysis failure', async () => {
      mockFrameworkAnalysisService.analyzeProject.mockRejectedValue(new Error('Access denied'));

      const result = await service.analyzeFramework('/nonexistent');

      expect(result.foundPageObjects).toEqual([]);
      expect(result.foundUtilities).toEqual([]);
      expect(result.projectStructure.testDir).toBe('/nonexistent/tests');
    });
  });

  // ==========================================================================
  // GET USER SESSIONS
  // ==========================================================================

  describe('getUserSessions', () => {
    it('should return user recent sessions', async () => {
      const sessions = [mockSession];
      mockPrisma.scriptSmithSession.findMany.mockResolvedValue(sessions);

      const result = await service.getUserSessions(mockUser.id);

      expect(result).toEqual(sessions);
      expect(mockPrisma.scriptSmithSession.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { files: true },
      });
    });

    it('should respect limit parameter', async () => {
      mockPrisma.scriptSmithSession.findMany.mockResolvedValue([]);

      await service.getUserSessions(mockUser.id, 5);

      expect(mockPrisma.scriptSmithSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });
});
