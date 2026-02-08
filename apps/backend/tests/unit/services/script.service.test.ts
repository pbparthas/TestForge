/**
 * Script Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Script } from '@prisma/client';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    script: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { ScriptService } from '../../../src/services/script.service.js';

describe('ScriptService', () => {
  let service: ScriptService;

  const mockScript: Script = {
    id: 'script-1',
    testCaseId: 'tc-1',
    projectId: 'proj-1',
    name: 'login.spec.ts',
    code: 'test("login", async () => { ... })',
    language: 'typescript' as const,
    framework: 'playwright' as const,
    status: 'draft' as const,
    version: 1,
    generatedBy: 'scriptsmith',
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ScriptService();
  });

  describe('create', () => {
    it('should create a script with default language, framework, and status', async () => {
      mockPrisma.script.create.mockResolvedValue(mockScript);

      const result = await service.create({
        testCaseId: 'tc-1',
        projectId: 'proj-1',
        name: 'login.spec.ts',
        code: 'test("login", async () => { ... })',
        createdById: 'user-1',
      });

      expect(result).toEqual(mockScript);
      expect(mockPrisma.script.create).toHaveBeenCalledWith({
        data: {
          testCaseId: 'tc-1',
          projectId: 'proj-1',
          name: 'login.spec.ts',
          code: 'test("login", async () => { ... })',
          language: 'typescript',
          framework: 'playwright',
          status: 'draft',
          createdById: 'user-1',
        },
      });
    });

    it('should create a script with explicit language, framework, status, and generatedBy', async () => {
      const cypressScript = {
        ...mockScript,
        language: 'javascript' as const,
        framework: 'cypress' as const,
        status: 'approved' as const,
        generatedBy: 'manual',
      };
      mockPrisma.script.create.mockResolvedValue(cypressScript);

      const result = await service.create({
        testCaseId: 'tc-1',
        projectId: 'proj-1',
        name: 'login.spec.ts',
        code: 'it("logs in", () => { ... })',
        language: 'javascript' as const,
        framework: 'cypress' as const,
        status: 'approved' as const,
        generatedBy: 'manual',
        createdById: 'user-1',
      });

      expect(result).toEqual(cypressScript);
      expect(mockPrisma.script.create).toHaveBeenCalledWith({
        data: {
          testCaseId: 'tc-1',
          projectId: 'proj-1',
          name: 'login.spec.ts',
          code: 'it("logs in", () => { ... })',
          language: 'javascript',
          framework: 'cypress',
          status: 'approved',
          generatedBy: 'manual',
          createdById: 'user-1',
        },
      });
    });
  });

  describe('findById', () => {
    it('should return script by id', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);

      const result = await service.findById('script-1');

      expect(result).toEqual(mockScript);
      expect(mockPrisma.script.findUnique).toHaveBeenCalledWith({ where: { id: 'script-1' } });
    });

    it('should throw NotFoundError if script not found', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        "Script with id 'nonexistent' not found"
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated scripts', async () => {
      mockPrisma.script.findMany.mockResolvedValue([mockScript]);
      mockPrisma.script.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(mockPrisma.script.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should apply all filters', async () => {
      mockPrisma.script.findMany.mockResolvedValue([mockScript]);
      mockPrisma.script.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        projectId: 'proj-1',
        testCaseId: 'tc-1',
        status: 'draft' as const,
        language: 'typescript' as const,
        framework: 'playwright' as const,
      });

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.script.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          testCaseId: 'tc-1',
          status: 'draft',
          language: 'typescript',
          framework: 'playwright',
        },
        skip: 0,
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should calculate correct pagination for page 3 with limit 5', async () => {
      mockPrisma.script.findMany.mockResolvedValue([]);
      mockPrisma.script.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 3, limit: 5 });

      expect(result.totalPages).toBe(5);
      expect(mockPrisma.script.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 })
      );
    });
  });

  describe('update', () => {
    it('should update script when it exists', async () => {
      const updatedScript = { ...mockScript, name: 'updated.spec.ts' };
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.update.mockResolvedValue(updatedScript);

      const result = await service.update('script-1', { name: 'updated.spec.ts' });

      expect(result.name).toBe('updated.spec.ts');
      expect(mockPrisma.script.findUnique).toHaveBeenCalledWith({ where: { id: 'script-1' } });
      expect(mockPrisma.script.update).toHaveBeenCalledWith({
        where: { id: 'script-1' },
        data: { name: 'updated.spec.ts' },
      });
    });

    it('should throw NotFoundError if script not found on update', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'New' })).rejects.toThrow(
        "Script with id 'nonexistent' not found"
      );
      expect(mockPrisma.script.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete script when it exists', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.delete.mockResolvedValue(mockScript);

      await service.delete('script-1');

      expect(mockPrisma.script.findUnique).toHaveBeenCalledWith({ where: { id: 'script-1' } });
      expect(mockPrisma.script.delete).toHaveBeenCalledWith({ where: { id: 'script-1' } });
    });

    it('should throw NotFoundError if script not found on delete', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        "Script with id 'nonexistent' not found"
      );
      expect(mockPrisma.script.delete).not.toHaveBeenCalled();
    });
  });

  describe('getByTestCase', () => {
    it('should return scripts for a test case ordered by version desc', async () => {
      const scripts = [
        { ...mockScript, version: 3 },
        { ...mockScript, id: 'script-2', version: 2 },
        { ...mockScript, id: 'script-3', version: 1 },
      ];
      mockPrisma.script.findMany.mockResolvedValue(scripts);

      const result = await service.getByTestCase('tc-1');

      expect(result).toHaveLength(3);
      expect(mockPrisma.script.findMany).toHaveBeenCalledWith({
        where: { testCaseId: 'tc-1' },
        orderBy: { version: 'desc' },
      });
    });
  });

  describe('getByProject', () => {
    it('should return scripts for a project ordered by updatedAt desc', async () => {
      mockPrisma.script.findMany.mockResolvedValue([mockScript]);

      const result = await service.getByProject('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockScript);
      expect(mockPrisma.script.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('approve', () => {
    it('should set script status to approved', async () => {
      const approvedScript = { ...mockScript, status: 'approved' as const };
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.update.mockResolvedValue(approvedScript);

      const result = await service.approve('script-1');

      expect(result.status).toBe('approved');
      expect(mockPrisma.script.update).toHaveBeenCalledWith({
        where: { id: 'script-1' },
        data: { status: 'approved' },
      });
    });

    it('should throw NotFoundError if script not found on approve', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(null);

      await expect(service.approve('nonexistent')).rejects.toThrow(
        "Script with id 'nonexistent' not found"
      );
      expect(mockPrisma.script.update).not.toHaveBeenCalled();
    });
  });

  describe('deprecate', () => {
    it('should set script status to deprecated', async () => {
      const deprecatedScript = { ...mockScript, status: 'deprecated' as const };
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.update.mockResolvedValue(deprecatedScript);

      const result = await service.deprecate('script-1');

      expect(result.status).toBe('deprecated');
      expect(mockPrisma.script.update).toHaveBeenCalledWith({
        where: { id: 'script-1' },
        data: { status: 'deprecated' },
      });
    });

    it('should throw NotFoundError if script not found on deprecate', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(null);

      await expect(service.deprecate('nonexistent')).rejects.toThrow(
        "Script with id 'nonexistent' not found"
      );
      expect(mockPrisma.script.update).not.toHaveBeenCalled();
    });
  });

  describe('incrementVersion', () => {
    it('should increment version by 1 and update code', async () => {
      const newCode = 'test("login v2", async () => { ... })';
      const updatedScript = { ...mockScript, version: 2, code: newCode };
      mockPrisma.script.findUnique.mockResolvedValue(mockScript);
      mockPrisma.script.update.mockResolvedValue(updatedScript);

      const result = await service.incrementVersion('script-1', newCode);

      expect(result.version).toBe(2);
      expect(result.code).toBe(newCode);
      expect(mockPrisma.script.update).toHaveBeenCalledWith({
        where: { id: 'script-1' },
        data: { code: newCode, version: 2 },
      });
    });

    it('should throw NotFoundError if script not found on incrementVersion', async () => {
      mockPrisma.script.findUnique.mockResolvedValue(null);

      await expect(service.incrementVersion('nonexistent', 'code')).rejects.toThrow(
        "Script with id 'nonexistent' not found"
      );
      expect(mockPrisma.script.update).not.toHaveBeenCalled();
    });
  });
});
