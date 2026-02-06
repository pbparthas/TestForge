/**
 * Sync Service
 * Bridges DB scripts ↔ Git filesystem
 */

import { prisma } from '../utils/prisma.js';
import { workspaceService } from './workspace.service.js';
import { gitService } from './git.service.js';
import { NotFoundError } from '../errors/index.js';

export interface SyncToGitInput {
  scriptId: string;
  userId: string;
  commitMessage?: string;
}

export interface SyncFromGitInput {
  projectId: string;
  filePaths?: string[];
}

export interface ConflictResult {
  hasConflict: boolean;
  dbContent?: string;
  fileContent?: string;
}

export interface SyncFromGitResult {
  updated: number;
  created: number;
  errors: string[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function generateFilePath(scriptName: string, language: string): string {
  const slug = slugify(scriptName);
  const ext = language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language;
  return `tests/${slug}.spec.${ext}`;
}

export class SyncService {
  async syncScriptToGit(input: SyncToGitInput): Promise<{ filePath: string; commitHash: string }> {
    const script = await prisma.script.findUnique({
      where: { id: input.scriptId },
    });

    if (!script) {
      throw new NotFoundError('Script', input.scriptId);
    }

    const integration = await gitService.getIntegration(script.projectId);
    const filePath = script.filePath || generateFilePath(script.name, script.language);

    // Write script code to filesystem
    await workspaceService.writeFile(script.projectId, filePath, script.code);

    // Commit and push to develop
    const message = input.commitMessage || `Update ${script.name}`;
    const { commit } = await gitService.commit(script.projectId, {
      message,
      files: [filePath],
      author: input.userId,
    });

    await gitService.push(script.projectId, integration.developBranch);

    // Update script record with file path and commit hash
    await prisma.script.update({
      where: { id: script.id },
      data: {
        filePath,
        gitCommitHash: commit,
      },
    });

    return { filePath, commitHash: commit };
  }

  async syncFilesFromGit(input: SyncFromGitInput): Promise<SyncFromGitResult> {
    const { projectId, filePaths } = input;
    const integration = await gitService.getIntegration(projectId);

    // Pull latest from develop
    await gitService.pull(projectId, integration.developBranch);

    // List files in workspace
    const allFiles = filePaths || await workspaceService.listFiles(projectId);
    const specFiles = allFiles.filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js') || f.endsWith('.test.ts') || f.endsWith('.test.js'));

    // Get existing scripts with file paths
    const existingScripts = await prisma.script.findMany({
      where: { projectId, filePath: { not: null } },
    });
    const scriptsByPath = new Map(existingScripts.map(s => [s.filePath, s]));

    let updated = 0;
    let created = 0;
    const errors: string[] = [];

    for (const file of specFiles) {
      try {
        const content = await workspaceService.readFile(projectId, file);
        const existing = scriptsByPath.get(file);

        if (existing) {
          if (existing.code !== content) {
            await prisma.script.update({
              where: { id: existing.id },
              data: { code: content },
            });
            updated++;
          }
        }
      } catch (err: unknown) {
        errors.push(`Failed to sync ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { updated, created, errors };
  }

  async detectConflicts(scriptId: string): Promise<ConflictResult> {
    const script = await prisma.script.findUnique({
      where: { id: scriptId },
    });

    if (!script) {
      throw new NotFoundError('Script', scriptId);
    }

    if (!script.filePath) {
      return { hasConflict: false };
    }

    const fileContent = await workspaceService.readFile(script.projectId, script.filePath);

    if (script.code === fileContent) {
      return { hasConflict: false };
    }

    return {
      hasConflict: true,
      dbContent: script.code,
      fileContent,
    };
  }
}

export const syncService = new SyncService();
