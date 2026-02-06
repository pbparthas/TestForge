/**
 * Workspace Service
 * Manages server-side filesystem for Git-integrated project workspaces
 */

import fs from 'fs/promises';
import path from 'path';
import { NotFoundError, ValidationError } from '../errors/index.js';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.DS_Store']);

export class WorkspaceService {
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || process.env.WORKSPACE_ROOT || '/testforge-workspace';
  }

  getWorkspacePath(projectId: string): string {
    return path.join(this.workspaceRoot, projectId);
  }

  async initializeWorkspace(projectId: string): Promise<string> {
    const workspacePath = this.getWorkspacePath(projectId);

    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'tests'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'pageObjects'), { recursive: true });

    return workspacePath;
  }

  async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    this.validatePath(filePath);
    const fullPath = path.join(this.getWorkspacePath(projectId), filePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async readFile(projectId: string, filePath: string): Promise<string> {
    this.validatePath(filePath);
    const fullPath = path.join(this.getWorkspacePath(projectId), filePath);

    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError('File', filePath);
      }
      throw err;
    }
  }

  async listFiles(projectId: string, dir?: string): Promise<string[]> {
    const basePath = dir
      ? path.join(this.getWorkspacePath(projectId), dir)
      : this.getWorkspacePath(projectId);
    const prefix = dir || '';

    return this.listFilesRecursive(basePath, prefix);
  }

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    this.validatePath(filePath);
    const fullPath = path.join(this.getWorkspacePath(projectId), filePath);
    await fs.rm(fullPath);
  }

  async cleanupWorkspace(projectId: string): Promise<void> {
    const workspacePath = this.getWorkspacePath(projectId);
    await fs.rm(workspacePath, { recursive: true, force: true });
  }

  private validatePath(filePath: string): void {
    if (filePath.startsWith('/')) {
      throw new ValidationError('Absolute paths are not allowed');
    }
    const normalized = path.normalize(filePath);
    if (normalized.startsWith('..') || normalized.includes('/../')) {
      throw new ValidationError('Path traversal is not allowed');
    }
  }

  private async listFilesRecursive(dirPath: string, prefix: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await this.listFilesRecursive(
          path.join(dirPath, entry.name),
          relativePath
        );
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }

    return files;
  }
}

export const workspaceService = new WorkspaceService();
