/**
 * Workspace Service Tests
 * TDD for server-side filesystem management of Git workspaces
 */

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({ default: mockFs, ...mockFs }));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceService } from '../../../src/services/workspace.service.js';
import { NotFoundError, ValidationError } from '../../../src/errors/index.js';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  const WORKSPACE_ROOT = '/testforge-workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspaceService(WORKSPACE_ROOT);
  });

  describe('initializeWorkspace', () => {
    it('should create workspace directory with subdirectories', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await service.initializeWorkspace('proj-123');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('proj-123'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('tests'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('pageObjects'),
        { recursive: true }
      );
    });

    it('should return the workspace path', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      const result = await service.initializeWorkspace('proj-123');

      expect(result).toContain('proj-123');
    });
  });

  describe('writeFile', () => {
    it('should write content to the correct path', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await service.writeFile('proj-123', 'tests/login.spec.ts', 'test content');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('login.spec.ts'),
        'test content',
        'utf-8'
      );
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        service.writeFile('proj-123', '../../../etc/passwd', 'malicious')
      ).rejects.toThrow(ValidationError);
    });

    it('should reject absolute paths', async () => {
      await expect(
        service.writeFile('proj-123', '/etc/passwd', 'malicious')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('readFile', () => {
    it('should read file content from workspace', async () => {
      mockFs.readFile.mockResolvedValue('file content');

      const result = await service.readFile('proj-123', 'tests/login.spec.ts');

      expect(result).toBe('file content');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('login.spec.ts'),
        'utf-8'
      );
    });

    it('should throw NotFoundError when file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      await expect(
        service.readFile('proj-123', 'tests/missing.spec.ts')
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        service.readFile('proj-123', '../../secrets.json')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listFiles', () => {
    it('should list files recursively, excluding .git', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'tests', isDirectory: () => true, isFile: () => false },
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'config.json', isDirectory: () => false, isFile: () => true },
      ]);
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'login.spec.ts', isDirectory: () => false, isFile: () => true },
      ]);

      const result = await service.listFiles('proj-123');

      expect(result).toContain('config.json');
      expect(result).toContain('tests/login.spec.ts');
      expect(result).not.toContain(expect.stringContaining('.git'));
    });

    it('should list files from a subdirectory', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'login.spec.ts', isDirectory: () => false, isFile: () => true },
        { name: 'signup.spec.ts', isDirectory: () => false, isFile: () => true },
      ]);

      const result = await service.listFiles('proj-123', 'tests');

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteFile', () => {
    it('should delete the specified file', async () => {
      mockFs.rm.mockResolvedValue(undefined);

      await service.deleteFile('proj-123', 'tests/old.spec.ts');

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('old.spec.ts')
      );
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        service.deleteFile('proj-123', '../../../important.txt')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('cleanupWorkspace', () => {
    it('should remove the entire workspace directory', async () => {
      mockFs.rm.mockResolvedValue(undefined);

      await service.cleanupWorkspace('proj-123');

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('proj-123'),
        { recursive: true, force: true }
      );
    });
  });

  describe('getWorkspacePath', () => {
    it('should return the full workspace path for a project', () => {
      const result = service.getWorkspacePath('proj-123');
      expect(result).toContain(WORKSPACE_ROOT);
      expect(result).toContain('proj-123');
    });
  });
});
